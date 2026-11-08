import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider, SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { signInWithClerk } from "@/lib/auth";

/** Hands a finished Clerk sign-in to Equidy's server, and ends the Clerk session after signing out. */
function Bridge({ onError }: { onError: (message: string) => void }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const clerk = useClerk();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) return;
    started.current = true;
    if (new URLSearchParams(window.location.search).get("signout")) {
      void clerk.signOut({ redirectUrl: "/login" });
      return;
    }
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Sign-in failed. Please try again.");
        await signInWithClerk(token);
        navigate("/", { replace: true });
      } catch (err) {
        onError((err as Error).message);
        // End the Clerk session so the form comes back and the person can try again.
        started.current = false;
        void clerk.signOut().catch(() => { /* the error above is already shown */ });
      }
    })();
  }, [isLoaded, isSignedIn, getToken, clerk, navigate, onError]);

  return null;
}

/** Clerk's sign-in form. Loaded only when Clerk is configured, so it adds nothing to the app otherwise. */
export default function ClerkSignIn({ publishableKey, onError }: { publishableKey: string; onError: (message: string) => void }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <Bridge onError={onError} />
      <div className="mt-8 flex justify-center">
        <SignIn routing="hash" />
      </div>
    </ClerkProvider>
  );
}
