import React from 'react';
import { Link } from 'react-router-dom';
import View from './view';
import { pizzaService } from '../service/service';
import { Order, OrderHistory, Role, User } from '../service/pizzaService';
import Button from '../components/button';

interface Props {
  user: User | null;
  setUser: (user: User) => void;
}

export default function DinerDashboard(props: Props) {
  const user = props.user || ({} as User);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [name, setName] = React.useState(user.name || '');
  const [email, setEmail] = React.useState(user.email || '');
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
  }, [user]);

  async function updateProfile() {
    const updatedUser = await pizzaService.updateUser({ ...user, name, email, password: password || undefined });
    props.setUser(updatedUser);
    setPassword('');
    setEditOpen(false);
  }

  React.useEffect(() => {
    (async () => {
      if (user) {
        const r: OrderHistory = await pizzaService.getOrders(user);
        setOrders(r.orders);
      }
    })();
  }, [user]);

  function formatRole(role: { role: Role; objectId?: string }) {
    if (role.role === Role.Franchisee) {
      return `Franchisee on ${role.objectId}`;
    }

    return role.role;
  }

  return (
    <View title="Your pizza kitchen">
      <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
        <div className="hs-tooltip inline-block">
          <img className="hs-tooltip-toggle relative inline-block size-[96px] rounded-full ring-2 ring-white hover:z-10" src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80" alt="Employee stock photo" />
        </div>
        <Button title="Edit" className="w-16 p-0" onPress={() => setEditOpen(true)} />

        <div className="my-4 text-lg text-orange-200 text-start grid grid-cols-5 gap-2">
          <div className="font-semibold text-orange-400">name:</div> <div className="col-span-4">{user.name}</div>
          <div className="font-semibold text-orange-400">email:</div> <div className="col-span-4">{user.email}</div>
          <div className="font-semibold text-orange-400">role:</div>{' '}
          <div className="col-span-4">
            {user.roles &&
              user.roles.map((role, index) => (
                <span key={index}>
                  {index === 0 ? '' : ', '} {formatRole(role)}
                </span>
              ))}
          </div>
        </div>

        {orders?.length === 0 && (
          <div className="text-neutral-100">
            How have you lived this long without having a pizza?{' '}
            <Link className="text-orange-400 underline font-semibold" to="/menu">
              Buy one
            </Link>{' '}
            now!
          </div>
        )}
        {orders?.length > 0 && (
          <>
            <div className="text-neutral-100">Here is your history of all the good times.</div>
            <div className="bg-neutral-100 overflow-clip my-4">
              <div className="flex flex-col">
                <div className="-m-1.5 overflow-x-auto">
                  <div className="p-1.5 min-w-full inline-block align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-start text-xs sm:text-sm font-medium">
                              ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-start text-xs sm:text-sm font-medium">
                              Price
                            </th>
                            <th scope="col" className="px-6 py-3 text-start text-xs sm:text-sm font-medium">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orders.map((order, index) => (
                            <tr key={index} className="hover:bg-gray-100">
                              <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm font-medium text-gray-800">{order.id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">{order.items.reduce((a, c) => a + c.price, 0).toLocaleString()} ₿</td>
                              <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">{order.date.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {editOpen && (
          <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-8">
            <div className="w-full max-w-lg rounded-xl bg-white text-gray-800 shadow-lg">
              <div className="flex items-center justify-between border-b bg-slate-200 px-4 py-3">
                <h3 id="edit-user-title" className="font-bold">Edit user</h3>
                <button type="button" aria-label="Close" onClick={() => setEditOpen(false)}>×</button>
              </div>
              <div className="grid gap-4 p-4">
                <label className="grid gap-1">Full name<input className="rounded border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="grid gap-1">Email address<input type="email" className="rounded border px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label className="grid gap-1">Password<input type="password" className="rounded border px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              </div>
              <div className="flex justify-end border-t bg-slate-200 px-4 py-3">
                <Button title="Update" onPress={updateProfile} />
              </div>
            </div>
          </div>
        )}
      </div>
    </View>
  );
}
