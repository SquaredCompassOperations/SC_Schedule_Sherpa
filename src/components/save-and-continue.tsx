import { useNavigate } from "@tanstack/react-router";
import { markModuleComplete } from "@/lib/module-status-store";

type Props = {
  /** The slug of the current module (matches MODULES[].slug). */
  moduleSlug: string;
  /** Where to navigate when clicked. Use the next module's slug. */
  nextHref?: string;
  /** Optional persist hook — runs before marking complete. */
  onSave?: () => void | Promise<void>;
  /** Optional label override. */
  label?: string;
  /** Optional disabled state. */
  disabled?: boolean;
  className?: string;
};

export function SaveAndContinue({
  moduleSlug,
  nextHref,
  onSave,
  label = "Save & Continue",
  disabled,
  className = "",
}: Props) {
  const navigate = useNavigate();

  const handleClick = async () => {
    if (disabled) return;
    try {
      await onSave?.();
    } catch (err) {
      console.error("SaveAndContinue: onSave failed", err);
      return;
    }
    markModuleComplete(moduleSlug);
    if (nextHref) navigate({ to: nextHref });
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`px-4 py-2 bg-success text-success-foreground font-bold text-xs uppercase tracking-widest rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {label} →
    </button>
  );
}
