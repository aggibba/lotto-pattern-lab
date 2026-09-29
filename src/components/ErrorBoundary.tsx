import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean; resetKey?: string }> {
  state: { failed: boolean; resetKey?: string } = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { resetKey?: string }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null
  }
  render() {
    if (this.state.failed) return <div className="notice" role="alert"><div><h2>This view could not be displayed</h2><p>Your browser data has not been changed. Try another page or reload the application.</p><button type="button" onClick={() => window.location.reload()}>Reload application</button></div></div>
    return this.props.children
  }
}
