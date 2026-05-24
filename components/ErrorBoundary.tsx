
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-[2.5rem] border shadow-sm m-6">
          <div className="bg-red-50 p-6 rounded-full text-red-600 shadow-inner">
            <AlertCircle className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase text-gray-900">Ops! Algo deu errado</h2>
            <p className="text-sm text-gray-500 font-medium max-w-md">
              Ocorreu um erro ao processar os dados do relatório. Isso pode ser causado por dados inconsistentes no banco de dados.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg hover:bg-blue-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Tentar Novamente
          </button>
          {this.state.error && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border w-full max-w-lg overflow-auto">
              <p className="text-[10px] font-mono text-red-500 text-left">
                {this.state.error.toString()}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
