import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <h1 className="text-lg font-medium">This page doesn't exist</h1>
      <p className="max-w-sm text-sm text-muted">The link may be broken or the page may have moved.</p>
      <Link to="/" className="btn-outline">Back to Equidy</Link>
    </div>
  );
}
