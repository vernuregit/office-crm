import Sidebar from "./Sidebar";
import Navbar  from "./Navbar";

const Layout = ({ children, title }) => (
  <div className="flex min-h-screen bg-[#fff]">
    <Sidebar />
    <div className="flex-1 flex flex-col overflow-hidden">
      <Navbar title={title} />
      <main className="flex-1 p-0 overflow-y-auto">
        {children}
      </main>
    </div>
  </div>
);

export default Layout;
