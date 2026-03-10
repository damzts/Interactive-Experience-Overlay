import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  name: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Wraps a single overlay layer. If it throws, the layer is silently removed
 * and the rest of the overlay stays intact. Nothing should go white mid-stream.
 */
export class LayerErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ieom] layer "${this.props.name}" threw:`, error, info.componentStack)
  }

  render() {
    if (this.state.error) return null
    return this.props.children
  }
}
