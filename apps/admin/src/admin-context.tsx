import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  ADMIN_INITIAL_STATE,
  adminReducer,
  type AdminEvent,
  type AdminState,
} from "@/admin-machine";

type Value = { state: AdminState; dispatch: Dispatch<AdminEvent> };

const AdminContext = createContext<Value | null>(null);

export function AdminProvider({
  children,
  initialState = ADMIN_INITIAL_STATE,
}: {
  children: ReactNode;
  initialState?: AdminState;
}) {
  const [state, dispatch] = useReducer(adminReducer, initialState);
  return (
    <AdminContext.Provider value={{ state, dispatch }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): Value {
  const value = useContext(AdminContext);
  if (!value) throw new Error("AdminProvider requerido");
  return value;
}
