import React, { useState, useEffect, useCallback, useRef } from "react";
import { Wallet, ChevronDown, Check, LogOut, Copy, Check as CheckIcon } from "lucide-react";
import { useWalletStore, NETWORKS } from "../stores/walletStore";

// 扩展 Window 接口以包含 ethereum
declare global {
	interface Window {
		ethereum?: {
			request: (args: { method: string; params?: any[] }) => Promise<any>;
			on: (eventName: string, handler: (...args: any[]) => void) => void;
			removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
			isMetaMask?: boolean;
		};
	}
}

const WalletComponent: React.FC = () => {
	// 使用 zustand store
	const {
		address,
		chainId,
		isConnected,
		balance,
		ensName,
		ensAvatar,
		userDisconnected,
		connectWallet,
		disconnectWallet,
		switchNetwork,
		formatAddress,
		formatBalance,
		getCurrentNetwork,
		isMetaMaskInstalled,
		updateWalletState, // 新增：用于更新状态而不触发弹窗的方法
	} = useWalletStore();

	// 本地状态
	const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
	const [showWalletDetails, setShowWalletDetails] = useState(false);
	const [copiedAddress, setCopiedAddress] = useState(false);
	
	// 使用 ref 存储事件处理函数，避免重复添加监听器
	const handlersRef = useRef<{
		accountsChanged?: (accounts: string[]) => void;
		chainChanged?: (chainId: string) => void;
	}>({});

	// 连接钱包处理函数
	const handleConnectWallet = async () => {
		setIsConnecting(true);
		try {
			await connectWallet();
		} finally {
			setIsConnecting(false);
		}
	};

	// 显示断开连接确认弹窗
	const showDisconnectConfirmDialog = () => {
		setShowDisconnectConfirm(true);
	};

	// 确认断开连接
	const confirmDisconnect = () => {
		disconnectWallet();
		setShowDisconnectConfirm(false);
	};

	// 取消断开连接
	const cancelDisconnect = () => {
		setShowDisconnectConfirm(false);
	};

	// 显示钱包详情
	const showWalletDetailsDialog = () => {
		setShowWalletDetails(true);
	};

	// 隐藏钱包详情
	const hideWalletDetails = () => {
		setShowWalletDetails(false);
	};

	// 复制钱包地址
	const copyAddress = async () => {
		if (address) {
			try {
				await navigator.clipboard.writeText(address);
				setCopiedAddress(true);
				setTimeout(() => setCopiedAddress(false), 2000);
			} catch (error) {
				console.error('复制失败:', error);
				// 降级方案：使用传统的复制方法
				const textArea = document.createElement('textarea');
				textArea.value = address;
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				setCopiedAddress(true);
				setTimeout(() => setCopiedAddress(false), 2000);
			}
		}
	};

	// 切换网络处理函数
	const handleSwitchNetwork = async (networkKey: keyof typeof NETWORKS) => {
		await switchNetwork(networkKey);
		setShowNetworkDropdown(false);
	};

	// 账户变化处理函数 - 使用 useCallback 避免重复创建
	const handleAccountsChanged = useCallback(async (accounts: string[]) => {
		console.log('handleAccountsChanged', accounts);
		
		if (accounts.length === 0) {
			// 账户被断开连接
			disconnectWallet();
		} else if (accounts[0] !== address) {
			// 账户切换，只更新状态，不重新连接（避免弹窗）
			await updateWalletState(accounts[0]);
		}
	}, [address, disconnectWallet, updateWalletState]);

	// 网络变化处理函数 - 使用 useCallback 避免重复创建
	const handleChainChanged = useCallback(async (newChainId: string) => {
		console.log('handleChainChanged', newChainId);
		
		// 只更新网络状态，不重新连接（避免弹窗）
		if (address && newChainId !== chainId) {
			await updateWalletState(address, newChainId);
		}
	}, [address, chainId, updateWalletState]);

	// 初始连接检查 - 避免不必要的弹窗
	const checkInitialConnection = useCallback(async () => {
		// 如果用户主动断开了连接，不自动重新连接
		if (userDisconnected) return;
		
		// 如果已经连接，不需要重复检查
		if (isConnected) return;
		
		try {
			const accounts = await window.ethereum!.request({ method: "eth_accounts" });
			if (accounts.length > 0) {
				// 静默获取连接状态，不触发连接弹窗
				await updateWalletState(accounts[0]);
			}
		} catch (error) {
			console.error("检查连接状态失败:", error);
		}
	}, [userDisconnected, isConnected, updateWalletState]);

	// 监听账户和网络变化
	useEffect(() => {
		if (!isMetaMaskInstalled()) return;

		// 存储当前的处理函数引用
		handlersRef.current.accountsChanged = handleAccountsChanged;
		handlersRef.current.chainChanged = handleChainChanged;

		// 添加事件监听器
		window.ethereum!.on("accountsChanged", handleAccountsChanged);
		window.ethereum!.on("chainChanged", handleChainChanged);

		// 初始连接检查
		checkInitialConnection();

		// 清理函数
		return () => {
			if (window.ethereum) {
				// 移除事件监听器
				if (handlersRef.current.accountsChanged) {
					window.ethereum.removeListener("accountsChanged", handlersRef.current.accountsChanged);
				}
				if (handlersRef.current.chainChanged) {
					window.ethereum.removeListener("chainChanged", handlersRef.current.chainChanged);
				}
			}
		};
	}, []); // 空依赖数组，只在组件挂载/卸载时执行

	return (
		<div className="relative">
			{!isConnected ? (
				<button
					onClick={handleConnectWallet}
					disabled={isConnecting}
					className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-400 disabled:to-purple-400 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-md"
				>
					<Wallet className="w-5 h-5" />
					<span className="text-sm font-semibold">
						{isConnecting ? "连接中..." : "连接钱包"}
					</span>
				</button>
			) : (
				<div className="flex items-center gap-3">
					{/* 网络显示和切换 */}
					<div className="relative">
						<button
							onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
							className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 border border-gray-200 shadow-sm hover:shadow-md"
						>
							<div className="w-2 h-2 rounded-full bg-green-500"></div>
							<span className="text-sm font-medium">{getCurrentNetwork()?.chainName.split(" ")[0] || "未知网络"}</span>
							<ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200" style={{ transform: showNetworkDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
						</button>

						{showNetworkDropdown && (
							<div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 min-w-[200px] backdrop-blur-sm bg-white/95">
								{Object.entries(NETWORKS).map(([key, network]) => (
									<button
										key={key}
										onClick={() => handleSwitchNetwork(key as keyof typeof NETWORKS)}
										className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl"
									>
										<span className="font-medium">{network.chainName}</span>
										{chainId === network.chainId && <Check className="w-4 h-4 text-green-500" />}
									</button>
								))}
							</div>
						)}
					</div>

					{/* 钱包信息 */}
					<div 
						className="bg-gradient-to-r from-gray-50 to-white text-gray-800 px-4 py-1 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 min-w-[200px] cursor-pointer"
						onClick={showWalletDetailsDialog}
						title="点击查看钱包详情"
					>
						<div className="flex items-start gap-3 w-full">
							{/* ENS 头像或默认钱包图标 */}
							<div className="flex-shrink-0 relative">
								{ensAvatar ? (
									<img
										src={ensAvatar}
										alt="ENS Avatar"
										className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
										onError={(e) => {
											// 如果头像加载失败，显示默认图标
											(e.currentTarget as HTMLElement).style.display = "none";
											((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement)!.style.display = "flex";
										}}
									/>
								) : null}
								<div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm ${ensAvatar ? "hidden" : "flex"}`}>
									<Wallet className="w-5 h-5 text-white" />
								</div>
								{/* 在线状态指示器 */}
								<div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
							</div>

							{/* 钱包信息 - 自适应高度布局 */}
							<div className="text-sm min-w-0 flex-1 overflow-hidden">
								{/* 主要显示：ENS名称或钱包地址 */}
								<div className="font-semibold text-gray-900 truncate leading-tight mb-1">
									{ensName ? ensName : formatAddress(address!)}
								</div>
								{/* 余额显示 */}
								<div className="text-xs text-gray-600 truncate leading-tight font-medium">
									{formatBalance(balance)} {getCurrentNetwork()?.nativeCurrency.symbol || "ETH"}
								</div>
							</div>
						</div>
					</div>

					{/* 断开连接按钮 */}
					<button
						onClick={showDisconnectConfirmDialog}
						className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
						title="断开连接"
					>
						<LogOut className="w-4 h-4" />
					</button>
				</div>
			)}

			{/* 点击外部关闭下拉菜单 */}
			{showNetworkDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowNetworkDropdown(false)} />}

			{/* 断开连接确认弹窗 */}
			{showDisconnectConfirm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={cancelDisconnect}>
					<div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center gap-4 mb-6">
							<div className="w-12 h-12 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
								<LogOut className="w-6 h-6 text-red-600" />
							</div>
							<div>
								<h3 className="text-xl font-bold text-gray-900">断开连接</h3>
								<p className="text-sm text-gray-500 mt-1">确认要断开钱包连接吗？</p>
							</div>
						</div>
						
						<div className="text-sm text-gray-600 mb-8 bg-gray-50 rounded-xl p-4">
							<p className="leading-relaxed">断开连接后，您需要重新连接才能使用钱包功能。当前连接的钱包信息将被清除。</p>
						</div>

						<div className="flex gap-3 justify-end">
							<button
								onClick={cancelDisconnect}
								className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-200 hover:shadow-sm"
							>
								取消
							</button>
							<button
								onClick={confirmDisconnect}
								className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
							>
								确认断开
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 钱包详情弹窗 */}
			{showWalletDetails && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={hideWalletDetails}>
					<div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center gap-4 mb-6">
							<div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
								<Wallet className="w-6 h-6 text-blue-600" />
							</div>
							<div>
								<h3 className="text-xl font-bold text-gray-900">钱包详情</h3>
								<p className="text-sm text-gray-500 mt-1">查看完整的钱包信息</p>
							</div>
						</div>
						
						<div className="space-y-4 mb-6">
							{/* 钱包头像和基本信息 */}
							<div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
								<div className="relative">
									{ensAvatar ? (
										<img
											src={ensAvatar}
											alt="ENS Avatar"
											className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-sm"
										/>
									) : (
										<div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
											<Wallet className="w-8 h-8 text-white" />
										</div>
									)}
									<div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
								</div>
								<div className="flex-1">
									<div className="font-semibold text-gray-900 text-lg">
										{ensName ? ensName : "钱包地址"}
									</div>
									<div className="text-sm text-gray-500 mt-1">
										{ensName ? "ENS 名称" : "普通地址"}
									</div>
								</div>
							</div>

							{/* 详细信息 */}
							<div className="space-y-3">
								{/* 钱包地址 */}
								<div className="p-3 bg-gray-50 rounded-lg">
									<div className="flex items-center justify-between mb-1">
										<div className="text-xs font-medium text-gray-500">钱包地址</div>
										<button
											onClick={copyAddress}
											className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
											title="复制地址"
										>
											{copiedAddress ? (
												<>
													<CheckIcon className="w-3 h-3" />
													已复制
												</>
											) : (
												<>
													<Copy className="w-3 h-3" />
													复制
												</>
											)}
										</button>
									</div>
									<div className="text-sm font-mono text-gray-900 break-all">
										{address}
									</div>
								</div>

								{/* 网络信息 */}
								<div className="p-3 bg-gray-50 rounded-lg">
									<div className="text-xs font-medium text-gray-500 mb-1">当前网络</div>
									<div className="text-sm text-gray-900">
										{getCurrentNetwork()?.chainName || "未知网络"}
									</div>
								</div>

								{/* 余额信息 */}
								<div className="p-3 bg-gray-50 rounded-lg">
									<div className="text-xs font-medium text-gray-500 mb-1">账户余额</div>
									<div className="text-sm text-gray-900 font-medium">
										{formatBalance(balance)} {getCurrentNetwork()?.nativeCurrency.symbol || "ETH"}
									</div>
								</div>

								{/* ENS信息（如果有） */}
								{ensName && (
									<div className="p-3 bg-gray-50 rounded-lg">
										<div className="text-xs font-medium text-gray-500 mb-1">ENS 名称</div>
										<div className="text-sm text-gray-900 font-medium">
											{ensName}
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="flex gap-3 justify-end">
							<button
								onClick={hideWalletDetails}
								className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-200 hover:shadow-sm"
							>
								关闭
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default WalletComponent;