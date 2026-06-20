import { Component, type ReactNode } from "react";

/**
 * Catches render/lifecycle errors in a subtree and shows the message instead of
 * unmounting to a blank page. Useful around the 3D Canvas and asset loaders,
 * where a single bad asset (or WebGL failure) would otherwise crash the app.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; label?: string; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label ?? "ErrorBoundary"}]`, error);
  }

  render() {
    if (this.state.error) {
      // A custom fallback (e.g. a three.js placeholder for use inside a Canvas,
      // where DOM elements are invalid) takes precedence over the message UI.
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="error-boundary">
          <strong>{this.props.label ?? "Something went wrong"}</strong>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
