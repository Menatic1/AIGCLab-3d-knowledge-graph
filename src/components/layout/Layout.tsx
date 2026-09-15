import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <div className="relative flex flex-1 min-h-0">
        <Sidebar />
        <main className="relative flex-1 min-w-0 overflow-auto scrollbar-sketch p-5 md:p-7">
          <div className="max-w-[1600px] mx-auto animate-pencil-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
