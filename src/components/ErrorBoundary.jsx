import React from 'react'
import { useErrorLogger } from '../hooks/useErrorLogger.js'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <p className="feedback feedback--error">Algo deu errado.</p>
    }
    return this.props.children
  }
}

export function ErrorBoundaryWithLogger({ page, children }) {
  const { reportError } = useErrorLogger(page)
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        reportError(error, { componentStack: errorInfo?.componentStack })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
