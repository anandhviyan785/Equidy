import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, EllipsisVertical, MonitorDown } from "lucide-react";
import { canPromptInstall, currentPlatform, installMode, promptInstall, runningStandalone, subscribeInstall, type InstallMode } from "@/lib/pwa";
import { cn } from "@/lib/format";
import { Modal } from "./ui";

/** Where Equidy can be installed from, recalculated when the browser's install prompt arrives or is used. */
export function useInstallMode(): InstallMode {
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  return installMode({ platform: currentPlatform(), standalone: runningStandalone(), canPrompt });
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-semibold">{n}</span>
      <span className="pt-0.5 text-sm">{children}</span>
    </li>
  );
}

const Icon = ({ as: As }: { as: typeof Share }) => <As className="mx-0.5 inline h-4 w-4 -translate-y-px" aria-hidden="true" />;

function IosSteps() {
  return (
    <ol className="space-y-3 text-left">
      <Step n={1}>Open equidy.website in <strong>Safari</strong>.</Step>
      <Step n={2}>Tap the <strong>Share</strong> button <Icon as={Share} /> at the bottom of the screen.</Step>
      <Step n={3}>Scroll down and tap <strong>Add to Home Screen</strong> <Icon as={SquarePlus} />.</Step>
      <Step n={4}>Tap <strong>Add</strong>. Equidy appears on your home screen and opens full-screen like an app.</Step>
    </ol>
  );
}

function ManualSteps() {
  const android = currentPlatform() === "android";
  return android ? (
    <ol className="space-y-3 text-left">
      <Step n={1}>Open equidy.website in <strong>Chrome</strong>.</Step>
      <Step n={2}>Tap the menu <Icon as={EllipsisVertical} /> in the top-right corner.</Step>
      <Step n={3}>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>, then <strong>Install</strong>.</Step>
    </ol>
  ) : (
    <ol className="space-y-3 text-left">
      <Step n={1}>Open equidy.website in <strong>Chrome</strong> or <strong>Edge</strong>.</Step>
      <Step n={2}>Click the install icon <Icon as={MonitorDown} /> at the right end of the address bar.</Step>
      <Step n={3}>Click <strong>Install</strong>. Equidy opens in its own window and gets a desktop and Start menu shortcut.</Step>
    </ol>
  );
}

/** "Install app" button: uses the browser's install dialog where it exists, otherwise shows step-by-step help. */
const MENU_ITEM = "flex w-full items-center gap-3 rounded-xl text-sm text-muted transition-colors hover:bg-elevated hover:text-fg";

/** `plain` drops the menu-item styling so the caller's className (for example a hero button) styles it alone. */
export function InstallAppButton({ collapsed = false, plain = false, className }: { collapsed?: boolean; plain?: boolean; className?: string }) {
  const mode = useInstallMode();
  const [guideOpen, setGuideOpen] = useState(false);
  if (mode === "installed") return null;

  const onClick = async () => {
    if (mode !== "prompt") {
      setGuideOpen(true);
      return;
    }
    try {
      await promptInstall();
    } catch (err) {
      console.error("[equidy] install prompt failed:", err);
      setGuideOpen(true);
    }
  };

  return (
    <>
      <button type="button" onClick={onClick} title={collapsed ? "Install app" : undefined} className={cn(!plain && MENU_ITEM, collapsed && "justify-center", className)}>
        <Download className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && "Install app"}
      </button>
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="Install Equidy">
        <p className="mb-4 text-sm text-muted">Free, no app store needed. It updates by itself whenever Equidy does.</p>
        {mode === "ios-guide" ? <IosSteps /> : <ManualSteps />}
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => setGuideOpen(false)}>Got it</button>
        </div>
      </Modal>
    </>
  );
}
