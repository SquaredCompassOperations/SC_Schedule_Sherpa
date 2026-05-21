import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Error 404
        </div>
        <h1 className="text-5xl font-extrabold text-foreground mt-2">Route Not Found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The requested workspace module does not exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
        >
          Return to Workspace
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ScheduleBuilder — GSA MAS / VA FSS Offer Automation" },
      {
        name: "description",
        content:
          "Guided intake, compliance engine, document generator, pricing workbook, and eOffer-ready package assembler for GSA MAS and VA FSS offers.",
      },
      { property: "og:title", content: "ScheduleBuilder — GSA MAS / VA FSS Offer Automation" },
      { name: "twitter:title", content: "ScheduleBuilder — GSA MAS / VA FSS Offer Automation" },
      { name: "description", content: "Automates GSA/VA FSS offer preparation, streamlining intake, compliance, and document generation." },
      { property: "og:description", content: "Automates GSA/VA FSS offer preparation, streamlining intake, compliance, and document generation." },
      { name: "twitter:description", content: "Automates GSA/VA FSS offer preparation, streamlining intake, compliance, and document generation." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e599ae73-c485-44fb-bc25-d26bfaca176c/id-preview-f0983f6d--8f44a953-2b65-42f6-a18a-34bf373764b0.lovable.app-1779391990484.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e599ae73-c485-44fb-bc25-d26bfaca176c/id-preview-f0983f6d--8f44a953-2b65-42f6-a18a-34bf373764b0.lovable.app-1779391990484.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <TopBar />
        <div className="flex grow">
          <AppSidebar />
          <main className="grow overflow-y-auto animate-fade-in">
            <div className="p-8 max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
