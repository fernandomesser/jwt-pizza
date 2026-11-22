# Curiosity Report: What CloudFormation Drift Detection Checks

## Topic and why I chose it

While learning to move an AWS deployment from manually created resources to CloudFormation, I wondered what happens when someone changes a resource directly in AWS after the stack has been created. Does CloudFormation notice the difference on its own, and how much of the live configuration does it compare with the template? I chose drift detection because it connects infrastructure as code to the practical problem of keeping a deployed environment consistent.

## How I researched it

I read AWS's documentation on drift detection for stacks and resources, then checked the CloudFormation resource support table to confirm that an S3 bucket can be used in a drift experiment. I used those details to design a small test that changes one bucket setting outside CloudFormation and then checks what the stack reports.

## Current state of the art

CloudFormation drift detection compares the expected values in a stack's template and parameters with the current values it can read from supported resources. It can check an entire stack or an individual resource. A changed supported property can make a resource `MODIFIED`; CloudFormation can show the expected and current values.

There are important limits. Drift detection is an operation I have to start; it is not a continuous monitor. It only checks resource types that support drift detection, and it only tracks property values explicitly set in the template or through template parameters. Defaulted properties are not necessarily checked unless I set them explicitly. A stack-level check also does not automatically check nested stacks; those need their own drift check. Drift detection reports differences, but it does not itself restore the resource to the template configuration.

AWS lists `AWS::S3::Bucket` as a resource type that supports drift detection. That makes a bucket a useful, small test case for checking whether an out-of-band versioning change is detected.

## Experiment: change bucket versioning outside the stack

### Question and hypothesis

**Question:** If I create an S3 bucket with versioning enabled in a CloudFormation template, then suspend versioning directly through the S3 API, will CloudFormation report the bucket as drifted?

**Hypothesis:** The bucket will be reported as `MODIFIED`, and the drift details will show the expected versioning status as `Enabled` and the current status as `Suspended`.

### Reproduction path

This experiment creates an S3 bucket, so use a unique stack name and clean it up afterward. Do not put objects in the bucket. AWS charges may apply to resources in your account. The experiment was run in `us-east-1` (N. Virginia).

1. Save the following template as `drift-demo.yaml`:

   ```yaml
   AWSTemplateFormatVersion: '2010-09-09'
   Description: Small stack for testing CloudFormation drift detection
   Resources:
     DemoBucket:
       Type: AWS::S3::Bucket
       Properties:
         VersioningConfiguration:
           Status: Enabled
   ```

2. Create the stack and wait for it to finish:

   ```bash
   aws cloudformation create-stack \
     --stack-name curiosity-drift-demo \
     --template-body file://drift-demo.yaml

   aws cloudformation wait stack-create-complete \
     --stack-name curiosity-drift-demo
   ```

3. Get the physical bucket name (CloudFormation generates a unique name):

   ```bash
   BUCKET_NAME=$(aws cloudformation describe-stack-resource \
     --stack-name curiosity-drift-demo \
     --logical-resource-id DemoBucket \
     --query 'StackResourceDetail.PhysicalResourceId' \
     --output text)

   echo "Bucket name: $BUCKET_NAME"
   ```

4. Confirm versioning is currently Enabled, then change it outside CloudFormation:

   ```bash
   # Optional: verify current state
   aws s3api get-bucket-versioning --bucket "$BUCKET_NAME"

   # Introduce drift
   aws s3api put-bucket-versioning \
     --bucket "$BUCKET_NAME" \
     --versioning-configuration Status=Suspended
   ```

5. Start stack-level drift detection:

   ```bash
   DRIFT_ID=$(aws cloudformation detect-stack-drift \
     --stack-name curiosity-drift-demo \
     --query 'StackDriftDetectionId' \
     --output text)

   echo "Drift detection ID: $DRIFT_ID"
   ```

6. Wait for detection to complete (poll until `DetectionStatus` is `DETECTION_COMPLETE`):

   ```bash
   aws cloudformation describe-stack-drift-detection-status \
     --stack-drift-detection-id "$DRIFT_ID"
   ```

7. Inspect the detailed resource drift:

   ```bash
   aws cloudformation describe-stack-resource-drifts \
     --stack-name curiosity-drift-demo \
     --stack-resource-drift-status-filters MODIFIED
   ```

8. Clean up (delete the empty test stack):

   ```bash
   aws cloudformation delete-stack --stack-name curiosity-drift-demo
   aws cloudformation wait stack-delete-complete --stack-name curiosity-drift-demo
   ```

### Results

- **Date and AWS Region:** November 21, 2026 — US East (N. Virginia) / `us-east-1`
- **Stack drift status:** `DRIFTED`
- **`DemoBucket` resource drift status:** `MODIFIED`
- **Property difference shown by CloudFormation:**  
  Property path related to `VersioningConfiguration` / `Status`  
  - Expected: `Enabled`  
  - Actual: `Suspended`  
  Difference type: `NOT_EQUAL`
- **Did the result match my hypothesis?** Yes. CloudFormation correctly detected the out-of-band change. The stack was marked `DRIFTED` and the bucket resource was marked `MODIFIED`, with the expected value (`Enabled`) and actual value (`Suspended`) clearly shown in the drift details.
- **Any issue or unexpected result:** None. Detection completed successfully. No other properties were reported as drifted. After deleting the stack, the bucket was cleaned up with no leftover resources.

## What I learned

Drift detection gives CloudFormation a way to compare supported live resource settings with the configuration the stack expects, but it is not an automatic safeguard against every manual change. It must be run, its coverage depends on resource type and explicitly configured properties, and it reports drift rather than repairing it.

Running the experiment confirmed that an S3 versioning change is among the properties CloudFormation can detect. When the versioning status was changed outside the stack, CloudFormation immediately surfaced the difference between the desired configuration (`Enabled`) and the actual state (`Suspended`). This made the gap between “what the template says” and “what is really running” concrete and easy to inspect.

Key practical takeaways:
- Prefer making changes through CloudFormation (or tools that update the stack) rather than the console or service APIs of the underlying resource.
- Run drift detection after any known out-of-band changes or on a regular schedule for important stacks.
- When drift is found, decide deliberately whether to restore the live resource to match the template or update the template to accept the new reality.
- Explicitly declare important properties in the template if you want them tracked for drift.

## References

- [AWS CloudFormation: Detect unmanaged configuration changes with drift detection](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html)
- [AWS CloudFormation: Detect drift on an entire stack](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/detect-drift-stack.html)
- [AWS CloudFormation: Detect drift on individual stack resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/detect-drift-resource.html)
- [AWS CloudFormation: Resource type support](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import-supported-resources.html)
- [AWS::S3::Bucket VersioningConfiguration](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-s3-bucket-versioningconfiguration.html)
- [Using drift-aware change sets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/drift-aware-change-sets.html)
