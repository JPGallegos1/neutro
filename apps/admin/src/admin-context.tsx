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

type AdminContextValue = {
  state: AdminState;
  dispatch: Dispatch<AdminEvent>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

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

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) {
    throw new Error("AdminProvider requerido");
  }
  return value;
}
