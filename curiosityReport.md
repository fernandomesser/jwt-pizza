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

This experiment creates an S3 bucket, so use a unique stack name and clean it up afterward. Do not put objects in the bucket. AWS charges may apply to resources in your account.

1. Save this as `drift-demo.yaml`:

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

3. Get the physical bucket name:

   ```bash
   aws cloudformation describe-stack-resource \
     --stack-name curiosity-drift-demo \
     --logical-resource-id DemoBucket \
     --query 'StackResourceDetail.PhysicalResourceId' \
     --output text
   ```

4. Change versioning outside CloudFormation. Replace `<bucket-name>` with the physical name from the previous command:

   ```bash
   aws s3api put-bucket-versioning \
     --bucket <bucket-name> \
     --versioning-configuration Status=Suspended
   ```

5. Start drift detection:

   ```bash
   aws cloudformation detect-stack-drift \
     --stack-name curiosity-drift-demo
   ```

   The command returns a drift detection ID. Check the status until detection completes:

   ```bash
   aws cloudformation describe-stack-drift-detection-status \
     --stack-drift-detection-id <drift-detection-id>
   ```

6. Inspect the resource result and property difference:

   ```bash
   aws cloudformation describe-stack-resource-drifts \
     --stack-name curiosity-drift-demo
   ```

7. Record the status and the expected/current property values below. Then delete the empty test stack:

   ```bash
   aws cloudformation delete-stack --stack-name curiosity-drift-demo
   aws cloudformation wait stack-delete-complete --stack-name curiosity-drift-demo
   ```

### Results to fill in after running the experiment

- Date and AWS Region: **[fill in]**
- Stack drift status: **[fill in]**
- `DemoBucket` resource drift status: **[fill in]**
- Property difference shown by CloudFormation: **[fill in]**
- Did the result match my hypothesis? Why or why not? **[fill in]**
- Any issue or unexpected result: **[fill in]**

I have not run this experiment yet; these fields are intentionally left open so the report records the actual result rather than an assumed one.

## What I learned

Drift detection gives CloudFormation a way to compare supported live resource settings with the configuration the stack expects, but it is not an automatic safeguard against every manual change. It must be run, its coverage depends on resource type and explicitly configured properties, and it reports drift rather than repairing it. The experiment should show whether an S3 versioning change is among the properties CloudFormation can detect in this setup. After recording the result, I can explain the difference between a stack's desired configuration and the actual state of its resources with evidence from a repeatable test.

## References

- [AWS CloudFormation: Detect unmanaged configuration changes with drift detection](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html)
- [AWS CloudFormation: Detect drift on an entire stack](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/detect-drift-stack.html)
- [AWS CloudFormation: Detect drift on individual stack resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/detect-drift-resource.html)
- [AWS CloudFormation: Resource type support](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import-supported-resources.html)
