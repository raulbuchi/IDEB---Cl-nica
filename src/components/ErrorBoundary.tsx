import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      let parsedError = null;
      try {
        if (this.state.error?.message) {
          parsedError = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-xl w-full bg-white p-8 rounded-lg shadow-lg border border-red-100">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-2xl font-bold">Ops! Algo deu errado.</h1>
            </div>
            
            <p className="text-gray-600 mb-6">
              Encontramos um erro inesperado. Por favor, tente recarregar a página ou contate o suporte se o problema persistir.
            </p>

            {parsedError ? (
              <div className="bg-red-50 p-4 rounded-md overflow-auto text-sm font-mono text-red-900 mb-6">
                <p className="font-bold mb-2">Erro de Banco de Dados (Firestore):</p>
                <p><strong>Operação:</strong> {parsedError.operationType}</p>
                <p><strong>Caminho:</strong> {parsedError.path}</p>
                <p><strong>Detalhe:</strong> {parsedError.error}</p>
              </div>
            ) : (
              <div className="bg-gray-100 p-4 rounded-md overflow-auto text-sm font-mono text-gray-800 mb-6">
                {this.state.error?.toString()}
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
