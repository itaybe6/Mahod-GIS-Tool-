import { Providers } from './providers';
import { AppRouter } from './router';

export function App(): JSX.Element {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
