import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { MapPinned } from "lucide-react";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { twMerge } from "tailwind-merge";
import { AdminProvider, useAdmin } from "@/admin-context";
import {
  pathForSection,
  sectionFromPathname,
  type AdminSection,
} from "@/admin-machine";
import {
  createHttpAreasClient,
  createRepoAreasClient,
  getAreasClient,
  setAreasClient,
} from "@/areas-client";
import { AreasPage } from "@/areas-page";
import {
  createFixtureComerciosClient,
  createHttpComerciosClient,
  getComerciosClient,
  setComerciosClient,
} from "@/comercios-client";
import { ComerciosPage } from "@/comercios-page";
import {
  createHttpLeadsClient,
  createRepoLeadsClient,
  getLeadsClient,
  setLeadsClient,
} from "@/leads/leads-client";
import { createMemoryLeadRepository } from "@/leads/lead";
import { createMemorySearchAreaRepository } from "@/search-area";
import "@/styles.css";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItem = cva(
  "rounded-md px-3 py-2 text-sm transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
  {
    variants: {
      active: {
        true: "bg-neutro-bg text-neutro-text",
        false: "text-neutro-text-muted [@media(hover:hover)]:hover:opacity-90",
      },
    },
    defaultVariants: { active: false },
  },
);

const badgeVariants = cva(
  "inline-flex w-fit rounded-md px-2 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        interno: "bg-neutro-accent-orange text-neutro-on-orange",
      },
    },
    defaultVariants: { tone: "interno" },
  },
);

type BadgeProps = VariantProps<typeof badgeVariants>;

const NAV: { section: AdminSection; label: string }[] = [
  { section: "comercios", label: "Comercios" },
  { section: "leads", label: "Leads" },
  { section: "areas", label: "Áreas" },
];

function Placeholder({ title }: { title: string }) {
  return (
    <section className="flex flex-1 flex-col gap-2 p-6">
      <h1 className="text-2xl font-medium tracking-tight text-neutro-text">
        {title}
      </h1>
      <p className="text-sm text-neutro-text-muted">
        Contenido del módulo en tickets posteriores.
      </p>
    </section>
  );
}

function ShellChrome({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = sectionFromPathname(pathname);

  return (
    <div className="flex min-h-screen bg-neutro-bg text-neutro-text">
      <aside
        className="flex w-60 shrink-0 flex-col gap-6 bg-neutro-surface px-4 py-6"
        data-admin-module="mapeo-de-leads"
        aria-label="Mapeo de leads"
      >
        <div className="flex items-center gap-2 px-2">
          <MapPinned className="size-4 text-neutro-accent-orange" aria-hidden />
          <p className="text-sm font-medium tracking-tight">Mapeo de leads</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Secciones">
          {NAV.map((item) => {
            const isActive = active === item.section;
            return (
              <Link
                key={item.section}
                to={pathForSection(item.section)}
                data-admin-nav={item.section}
                aria-current={isActive ? "page" : undefined}
                className={cn(navItem({ active: isActive }))}
                onClick={() =>
                  dispatch({ type: "navigate", section: item.section })
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-2">
          <span
            data-admin-badge="interno"
            className={cn(
              badgeVariants({ tone: "interno" } satisfies BadgeProps),
            )}
          >
            Interno
          </span>
          <p
            data-admin-access-footer
            className="text-xs text-neutro-text-muted"
          >
            Acceso vía {state.accessLabel}
          </p>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

function RootLayout() {
  return (
    <AdminProvider>
      <ShellChrome>
        <Outlet />
      </ShellChrome>
    </AdminProvider>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/comercios" });
  },
});

const comerciosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/comercios",
  loader: async () => {
    const areas = await getAreasClient()
      .list()
      .catch(() => []);
    const area = areas[0];
    const [comercios, leads] = await Promise.all([
      getComerciosClient().search({
        lat: area?.center.lat ?? -32.9442,
        lng: area?.center.lng ?? -60.6505,
        radiusKm: area?.radiusKm ?? 3,
      }),
      getLeadsClient()
        .list()
        .catch(() => []),
    ]);
    const now = Date.now();
    return {
      comercios,
      revision: now,
      leads,
      leadsRevision: now,
    };
  },
  component: function ComerciosRouteView() {
    const data = comerciosRoute.useLoaderData();
    return (
      <ComerciosPage
        loadedComercios={data.comercios}
        loadedRevision={data.revision}
        loadedLeads={data.leads}
        loadedLeadsRevision={data.leadsRevision}
      />
    );
  },
});

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leads",
  component: () => <Placeholder title="Leads" />,
});

const areasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/areas",
  loader: async () => {
    const areas = await getAreasClient().list();
    return {
      areas,
      revision: Date.now(),
    };
  },
  component: function AreasRouteView() {
    const data = areasRoute.useLoaderData();
    return (
      <AreasPage loadedAreas={data.areas} loadedRevision={data.revision} />
    );
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  comerciosRoute,
  leadsRoute,
  areasRoute,
]);

export function createAdminRouter(options?: { initialPath?: string }) {
  if (options?.initialPath !== undefined) {
    return createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: [options.initialPath],
      }),
      defaultPreload: "intent",
    });
  }
  return createRouter({
    routeTree,
    defaultPreload: "intent",
  });
}

const browserRouter = createAdminRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof browserRouter;
  }
}

export function AdminApp({
  router = browserRouter,
}: {
  router?: ReturnType<typeof createAdminRouter>;
}) {
  return <RouterProvider router={router} />;
}

const rootElement = document.getElementById("root");
if (rootElement && rootElement.dataset.adminMounted !== "1") {
  setAreasClient(
    import.meta.env.PROD
      ? createHttpAreasClient()
      : createRepoAreasClient(createMemorySearchAreaRepository()),
  );
  setComerciosClient(
    import.meta.env.PROD
      ? createHttpComerciosClient()
      : createFixtureComerciosClient(),
  );
  setLeadsClient(
    import.meta.env.PROD
      ? createHttpLeadsClient()
      : createRepoLeadsClient(createMemoryLeadRepository()),
  );
  rootElement.dataset.adminMounted = "1";
  createRoot(rootElement).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
