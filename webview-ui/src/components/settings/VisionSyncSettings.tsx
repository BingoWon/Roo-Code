import { useCallback, useState, useEffect } from "react"
import { Smartphone, Wifi, WifiOff, Info, Users, Globe, ArrowLeft } from "lucide-react"
import { vscode } from "@/utils/vscode"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
// Define types to match backend response structure
interface VisionSyncStatus {
	running: boolean
	config: {
		enabled: boolean
		port: number
		discoveryPort: number
		maxConnections: number
		serviceName: string
	}
	networkInfo?: {
		localIP: string
		networkSegment: string
		interfaceName: string
		isOnline: boolean
	}
	connections: Array<{
		id: string
		clientType: string
		version: string
		connectedAt: string
		lastActivity: string
	}>
	connectedClients: Array<{
		connectionId: string
		connectedAt: string
		lastActivity: string
		syncedMessageCount: number
	}>
	websocketPort?: number
	discoveryPort?: number
}

interface VisionSyncResponse {
	type: "visionSyncStatus"
	status: VisionSyncStatus | null
}

interface VisionSyncSettingsProps {
	onDone?: () => void
}

export function VisionSyncSettings({ onDone }: VisionSyncSettingsProps) {
	const [status, setStatus] = useState<VisionSyncStatus | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	// Load current status
	useEffect(() => {
		const loadStatus = async () => {
			try {
				// Request VisionSync status from extension
				vscode.postMessage({
					type: "getVisionSyncStatus",
				})
			} catch (error) {
				console.error("Failed to load VisionSync status:", error)
			} finally {
				setLoading(false)
			}
		}

		loadStatus()

		// Listen for status updates
		const handleMessage = (event: MessageEvent<VisionSyncResponse>) => {
			const message = event.data
			if (message.type === "visionSyncStatus") {
				setStatus(message.status)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleToggleEnabled = useCallback(async (event: any) => {
		const enabled = event.target.checked
		setSaving(true)
		try {
			vscode.postMessage({
				type: "updateVisionSyncSettings",
				payload: { enabled },
			})
		} catch (error) {
			console.error("Failed to toggle VisionSync:", error)
		} finally {
			setSaving(false)
		}
	}, [])

	// Header component to avoid duplication
	const Header = () => (
		<div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
			<button onClick={onDone} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
				<ArrowLeft className="h-5 w-5" />
			</button>
			<div className="flex items-center gap-3">
				<Smartphone className="h-6 w-6" />
				<h1 className="text-xl font-semibold">VisionSync</h1>
			</div>
		</div>
	)

	if (loading) {
		return (
			<div className="h-full flex flex-col">
				<Header />
				<div className="flex-1 flex items-center justify-center">
					<div className="text-gray-500">Loading VisionSync settings...</div>
				</div>
			</div>
		)
	}

	return (
		<div className="h-full flex flex-col">
			<Header />
			<div className="flex-1 overflow-y-auto px-3 py-4">
				<div className="space-y-4">
					{/* Service Status */}
					<div className="border rounded-lg p-4 space-y-4">
						<div className="flex items-center gap-2">
							{status?.running ? (
								<Wifi className="h-4 w-4 text-green-500" />
							) : (
								<WifiOff className="h-4 w-4 text-red-500" />
							)}
							<h3 className="font-medium">Service Status</h3>
						</div>

						<div className="flex items-center justify-between">
							<label htmlFor="vision-sync-enabled">Enable VisionSync</label>
							<VSCodeCheckbox
								id="vision-sync-enabled"
								checked={status?.config?.enabled ?? false}
								onChange={handleToggleEnabled}
								disabled={saving}
							/>
						</div>

						{status?.config?.enabled && (
							<div className="space-y-3 pt-3 border-t">
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<div className="text-xs opacity-70">Status</div>
										<div className="flex items-center gap-2">
											<span
												className={`px-2 py-1 rounded text-xs ${
													status.running
														? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
														: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
												}`}>
												{status.running ? "Running" : "Stopped"}
											</span>
										</div>
									</div>
									<div>
										<div className="text-xs opacity-70">Connections</div>
										<div className="flex items-center gap-2">
											<Users className="h-3 w-3" />
											<span>
												{status.connections?.length ?? 0} / {status.config?.maxConnections ?? 0}
											</span>
										</div>
									</div>
								</div>

								{/* Connected Devices Details */}
								{status.connections && status.connections.length > 0 && (
									<div className="space-y-2 pt-3 border-t">
										<div className="text-xs opacity-70 font-medium">Connected Devices</div>
										{status.connections.map((connection: VisionSyncStatus["connections"][0]) => (
											<div
												key={connection.id}
												className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
												<div>
													<div className="font-medium text-sm">{connection.clientType}</div>
													<div className="text-xs opacity-70">
														Version: {connection.version} • Connected:{" "}
														{new Date(connection.connectedAt).toLocaleTimeString()}
													</div>
												</div>
												<span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
													Active
												</span>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>

					{/* Network Information */}
					{status?.config?.enabled && status.networkInfo && (
						<div className="border rounded-lg p-4 space-y-4">
							<div className="flex items-center gap-2">
								<Globe className="h-4 w-4" />
								<h3 className="font-medium">Network Information</h3>
							</div>

							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<div className="text-xs opacity-70">Local IP</div>
									<div className="font-mono">{status.networkInfo.localIP}</div>
								</div>
								<div>
									<div className="text-xs opacity-70">Network Segment</div>
									<div className="font-mono">{status.networkInfo.networkSegment}</div>
								</div>
								<div>
									<div className="text-xs opacity-70">Interface</div>
									<div className="font-mono">{status.networkInfo.interfaceName}</div>
								</div>
								<div>
									<div className="text-xs opacity-70">Online Status</div>
									<span
										className={`px-2 py-1 rounded text-xs ${
											status.networkInfo.isOnline
												? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
												: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
										}`}>
										{status.networkInfo.isOnline ? "Online" : "Offline"}
									</span>
								</div>
							</div>
						</div>
					)}

					{/* Help Information */}
					<div className="border rounded-lg p-4 space-y-4">
						<div className="flex items-center gap-2">
							<Info className="h-4 w-4" />
							<h3 className="font-medium">How to Connect</h3>
						</div>

						<div className="text-sm space-y-2">
							<p>To connect your visionOS device:</p>
							<ol className="list-decimal list-inside space-y-1 ml-4">
								<li>Ensure your visionOS device is on the same network</li>
								<li>Open your visionOS app and scan for Roo Code services</li>
								<li>Select this device from the discovery list</li>
								<li>Start chatting with Roo Code AI through your visionOS device</li>
							</ol>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
