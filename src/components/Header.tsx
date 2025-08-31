import {WalletComponent} from "./Wallet";

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">Web3 DApp</h1>
          </div>

          {/* 钱包组件 */}
          <WalletComponent />
        </div>
      </div>
    </header>
  );
};
