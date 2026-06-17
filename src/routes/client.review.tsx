import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIntake } from "@/lib/intake-store";
import { useDocStore } from "@/lib/doc-store";
import { DOCUMENT_QUEUE } from "@/lib/mock-data";
import {
  useReview,
  addSignOff,
  removeSignOff,
  GATE_DELIVERABLES,
} from "@/lib/review-store";

export const Route = createFileRoute("/client/review")({
  head: () => ({ meta: [{ title: "Review & Sign-Off — ScheduleBuilder" }] }),
  component: ClientReview,
});

// Deliverable kinds the client is asked to sign off on (Pricing Review + Compliance).
const SIGN_OFF_KINDS = [
  ...GATE_DELIVERABLES["Pricing Review"],
  ...GATE_DELIVERABLES["Compliance Matrix Sign-off"],
].filter((k) => k !== "pricing-workbook");

function ClientReview() {
  const { user, fullName } = useAuth();
  const intake = useIntake();
  const docs = useDocStore();
  const review = useReview();

  const email = (user?.email ?? "").toLowerCase();
  const negotiator = intake.negotiators.find(
    (n) => n.email.toLowerCase() === email && n.authorizedToSign,
  );
  const canSign = Boolean(negotiator);

  const docByKind = useMemo(() => new Map(DOCUMENT_QUEUE.map((d) => [d.kind, d])), []);

  const items = SIGN_OFF_KINDS.flatMap((key) => {
    if (key.includes("|")) {
      return key.split("|").map((alt) => ({ key: alt, doc: docByKind.get(alt) }));
    }
    return [{ key, doc: docByKind.get(key) }];
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Step 3 — Review &amp; Sign-Off
        </div>
        <h1 className="text-3xl font-bold mt-1">Review &amp; sign off</h1>
        <p className="text-sm text-muted-foreground mt-1">
          When our team marks a deliverable ready, you'll be able to review and sign off here.
          Only Authorized Negotiators on your offer can sign.
        </p>
      </div>

      {!canSign && (
        <div className="border border-warning bg-warning/10 rounded-sm p-4 text-sm">
          You're signed in as <span className="font-mono">{email || "—"}</span>. This email isn't
          listed as an Authorized Negotiator with signing authority on your offer, so the sign-off
          buttons are disabled. Ask your account team to add you to the negotiators list.
        </div>
      )}

      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Deliverables awaiting your sign-off
        </div>
        <ul className="divide-y divide-border">
          {items.map(({ key, doc }) => {
            const name = doc?.name ?? key;
            const ds = doc ? docs[doc.name] : undefined;
            const status = ds?.status ?? "draft";
            const ready = status === "review" || status === "final";
            const myEmail = email;
            const mine = review.signOffs.find(
              (s) => s.deliverable === key && s.signerEmail.toLowerCase() === myEmail,
            );
            const allForItem = review.signOffs.filter((s) => s.deliverable === key);
            return (
              <SignOffRow
                key={key}
                docKey={key}
                name={name}
                status={status}
                ready={ready}
                canSign={canSign}
                signerName={negotiator?.name || fullName || ""}
                signerEmail={email}
                signerTitle={negotiator?.title || "Authorized Negotiator"}
                mine={mine}
                allForItem={allForItem}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SignOffRow({
  docKey,
  name,
  status,
  ready,
  canSign,
  signerName,
  signerEmail,
  signerTitle,
  mine,
  allForItem,
}: {
  docKey: string;
  name: string;
  status: string;
  ready: boolean;
  canSign: boolean;
  signerName: string;
  signerEmail: string;
  signerTitle: string;
  mine: { signedAt: number } | undefined;
  allForItem: { signerName: string; signedAt: number }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{name}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{docKey}</div>
        </div>
        <span
          className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
            status === "final"
              ? "text-success border-success/40 bg-success/10"
              : status === "review"
                ? "text-warning border-warning/40 bg-warning/10"
                : "text-muted-foreground border-border bg-muted"
          }`}
        >
          {status === "review" ? "Ready for review" : status}
        </span>
        {mine ? (
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm bg-success text-success-foreground">
            ✓ Signed
          </span>
        ) : (
          <button
            disabled={!ready || !canSign}
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm border border-primary text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sign off
          </button>
        )}
      </div>

      {allForItem.length > 0 && (
        <div className="mt-2 text-[11px] font-mono text-muted-foreground">
          Signed by:{" "}
          {allForItem
            .map((s) => `${s.signerName} (${new Date(s.signedAt).toLocaleDateString()})`)
            .join(", ")}
        </div>
      )}

      {open && !mine && (
        <div className="mt-3 border border-border rounded-sm bg-surface p-3 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Sign as
          </div>
          <div className="text-sm">
            {signerName} · {signerTitle} · <span className="font-mono">{signerEmail}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            By signing, you certify the deliverable is acceptable and authorize its inclusion in the
            final offer package.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                addSignOff({
                  deliverable: docKey,
                  signerName,
                  signerEmail,
                  signerTitle,
                  signedAt: Date.now(),
                });
                setOpen(false);
              }}
              className="px-3 py-1.5 bg-success text-success-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm"
            >
              Confirm Sign-Off
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 border border-border text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mine && (
        <div className="mt-2">
          <button
            onClick={() => removeSignOff(docKey, signerEmail)}
            className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:underline"
          >
            Revoke my sign-off
          </button>
        </div>
      )}
    </li>
  );
}
