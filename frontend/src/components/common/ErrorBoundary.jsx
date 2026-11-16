// FR-PUB-06 — bir bölümün hatası o bölümle sınırlanır; sayfa çökmez.
import { Component } from 'react';
import { ErrorState } from './ErrorState.jsx';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Bileşen hatası', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // `fallback={null}` bilerek hiçbir şey göstermemek demektir (ör. oynatıcı).
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState
          title="Bu bölüm yüklenemedi"
          description="Sayfanın geri kalanı çalışmaya devam ediyor."
          onRetry={() => this.setState({ error: null })}
        />
      </div>
    );
  }
}
