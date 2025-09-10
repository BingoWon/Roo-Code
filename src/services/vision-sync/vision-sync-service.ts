/**
 * VisionSync Service
 * Main service orchestrator for visionOS integration
 */

import { EventEmitter } from "events"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { VisionSyncConfig, VisionConnection, VisionMessage, VisionServiceEventData, NetworkInfo } from "./types"
import { DEFAULT_VISION_SYNC_CONFIG, VisionServiceEvent } from "./types"
import { VisionWebSocketServer } from "./websocket-server"
import { VisionDiscoveryServer } from "./discovery-server"
import { VisionAIBridge } from "./ai-bridge"
import { getNetworkInfo, findAvailablePort } from "./network-utils"
import { isAIMessage } from "./message-utils"

export class VisionSyncService extends EventEmitter {
	private config: VisionSyncConfig
	private websocketServer: VisionWebSocketServer | null = null
	private discoveryServer: VisionDiscoveryServer | null = null
	private aiBridge: VisionAIBridge
	private isRunning = false
	private networkInfo: NetworkInfo | null = null
	private cleanupInterval: NodeJS.Timeout | null = null
	private provider: ClineProvider | null = null

	constructor(config: Partial<VisionSyncConfig> = {}) {
		super()

		this.config = { ...DEFAULT_VISION_SYNC_CONFIG, ...config }
		this.aiBridge = new VisionAIBridge()

		// Forward AI bridge events
		this.aiBridge.on("error", (error) => {
			this.emit(VisionServiceEvent.ERROR, { error, context: "AI Bridge" })
		})
	}

	/**
	 * Start the VisionSync service
	 */
	async start(provider?: ClineProvider): Promise<void> {
		if (this.isRunning) {
			throw new Error("VisionSync service is already running")
		}

		try {
			console.log("[VisionSync] Starting service...")

			// Initialize AI bridge with provider for bidirectional sync
			if (provider) {
				this.provider = provider
				this.aiBridge.initialize(provider)
			}

			// Get network information
			this.networkInfo = await getNetworkInfo()
			console.log(`[VisionSync] Network info:`, this.networkInfo)

			// Find available ports
			const websocketPort = await findAvailablePort(this.config.port)
			const discoveryPort = await findAvailablePort(this.config.discoveryPort)

			if (!websocketPort || !discoveryPort) {
				throw new Error("Unable to find available ports")
			}

			// Update config with actual ports
			this.config = {
				...this.config,
				port: websocketPort,
				discoveryPort: discoveryPort,
			}

			// Start WebSocket server
			this.websocketServer = new VisionWebSocketServer(websocketPort, this.config.maxConnections)
			this.setupWebSocketEventHandlers()
			this.setupAIBridgeHandlers()
			await this.websocketServer.start()

			// Start discovery server
			this.discoveryServer = new VisionDiscoveryServer(discoveryPort, websocketPort, this.config.serviceName)
			await this.discoveryServer.start()

			// Start cleanup interval
			this.startCleanupInterval()

			this.isRunning = true

			this.emit(VisionServiceEvent.SERVICE_STARTED, {
				port: websocketPort,
				discoveryPort: discoveryPort,
			})

			console.log(`[VisionSync] Service started successfully`)
			console.log(`[VisionSync] WebSocket server: ws://${this.networkInfo.localIP}:${websocketPort}`)
			console.log(`[VisionSync] Discovery server: http://${this.networkInfo.localIP}:${discoveryPort}/discover`)
		} catch (error) {
			console.error("[VisionSync] Failed to start service:", error)
			await this.stop() // Cleanup on failure
			throw error
		}
	}

	/**
	 * Stop the VisionSync service
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return
		}

		console.log("[VisionSync] Stopping service...")

		// Stop cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}

		// Stop servers
		const stopPromises: Promise<void>[] = []

		if (this.websocketServer) {
			stopPromises.push(this.websocketServer.stop())
		}

		if (this.discoveryServer) {
			stopPromises.push(this.discoveryServer.stop())
		}

		await Promise.all(stopPromises)

		// Reset state
		this.websocketServer = null
		this.discoveryServer = null
		this.isRunning = false

		this.emit(VisionServiceEvent.SERVICE_STOPPED, {})
		console.log("[VisionSync] Service stopped")
	}

	/**
	 * Set up WebSocket server event handlers
	 */
	private setupWebSocketEventHandlers(): void {
		if (!this.websocketServer) return

		// Set up event handlers for WebSocket server
		this.websocketServer.on(VisionServiceEvent.CLIENT_CONNECTED, (data: any) => {
			console.log(`[VisionSync] Client connected: ${data.connection.id} (${data.connection.clientType})`)
			this.emit(VisionServiceEvent.CLIENT_CONNECTED, data)
			// 通知 VSCode 插件状态更新
			this.notifyStatusUpdate()
		})

		this.websocketServer.on(VisionServiceEvent.CLIENT_DISCONNECTED, (data: any) => {
			console.log(`[VisionSync] Client disconnected: ${data.connectionId}`)
			this.handleClientDisconnection(data.connectionId)
			this.emit(VisionServiceEvent.CLIENT_DISCONNECTED, data)
			// 通知 VSCode 插件状态更新
			this.notifyStatusUpdate()
		})

		this.websocketServer.on(VisionServiceEvent.MESSAGE_RECEIVED, async (data: any) => {
			await this.handleMessage(data.connectionId, data.message)
			this.emit(VisionServiceEvent.MESSAGE_RECEIVED, data)
		})

		this.websocketServer.on(VisionServiceEvent.ERROR, (data: any) => {
			this.emit(VisionServiceEvent.ERROR, data)
		})
	}

	/**
	 * Start cleanup interval for inactive clients
	 */
	private startCleanupInterval(): void {
		// Clean up inactive clients every hour
		this.cleanupInterval = setInterval(
			() => {
				// Cleanup is now handled by individual client activity tracking
				console.log("[VisionSync] Cleanup interval - client activity managed by AI bridge")
			},
			60 * 60 * 1000,
		)
	}

	/**
	 * Send message to specific client
	 */
	sendMessage(connectionId: string, message: VisionMessage): boolean {
		if (!this.websocketServer) {
			return false
		}
		return this.websocketServer.sendMessage(connectionId, message)
	}

	/**
	 * Broadcast message to all clients
	 */
	broadcast(message: VisionMessage): number {
		if (!this.websocketServer) {
			return 0
		}
		return this.websocketServer.broadcast(message)
	}

	/**
	 * Get all connected clients
	 */
	getConnections(): VisionConnection[] {
		if (!this.websocketServer) {
			return []
		}
		return this.websocketServer.getConnections()
	}

	/**
	 * Get connection by ID
	 */
	getConnection(connectionId: string): VisionConnection | null {
		if (!this.websocketServer) {
			return null
		}
		return this.websocketServer.getConnection(connectionId)
	}

	/**
	 * Get current configuration
	 */
	getConfig(): VisionSyncConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration (requires restart to take effect)
	 */
	updateConfig(newConfig: Partial<VisionSyncConfig>): void {
		this.config = { ...this.config, ...newConfig }
	}

	/**
	 * Get network information
	 */
	getNetworkInfo(): NetworkInfo | null {
		return this.networkInfo
	}

	/**
	 * Get service status
	 */
	getStatus() {
		return {
			running: this.isRunning,
			config: this.config,
			networkInfo: this.networkInfo,
			connections: this.getConnections(),
			connectedClients: this.aiBridge.getConnectedClients(),
			websocketPort: this.websocketServer?.currentPort,
			discoveryPort: this.discoveryServer?.currentPort,
		}
	}

	/**
	 * 通知 VSCode 插件状态更新
	 */
	private async notifyStatusUpdate(): Promise<void> {
		if (this.provider) {
			try {
				const status = this.getStatus()
				await this.provider.postMessageToWebview({
					type: "visionSyncStatus",
					status: status,
				})
			} catch (error) {
				console.error("[VisionSync] Failed to notify status update:", error)
			}
		}
	}

	/**
	 * Setup AI Bridge event handlers for bidirectional sync
	 */
	private setupAIBridgeHandlers(): void {
		// Listen for messages that need to be sent to specific clients
		this.aiBridge.on("messageForClient", (data: { connectionId: string; message: VisionMessage }) => {
			if (this.websocketServer) {
				const sent = this.websocketServer.sendMessage(data.connectionId, data.message)
				if (sent) {
					this.emit(VisionServiceEvent.MESSAGE_SENT, {
						connectionId: data.connectionId,
						message: data.message,
					})
				}
			}
		})
	}

	/**
	 * Enhanced message handling with client registration
	 */
	private async handleMessage(connectionId: string, message: VisionMessage): Promise<void> {
		try {
			console.log(
				`[VisionSync] handleMessage called - connectionId: ${connectionId}, messageType: ${message.type}`,
			)

			if (!this.websocketServer) {
				console.warn(`[VisionSync] No websocket server available`)
				return
			}

			const connection = this.websocketServer.getConnection(connectionId)
			if (!connection) {
				console.warn(`[VisionSync] Message from unknown connection: ${connectionId}`)
				return
			}

			console.log(`[VisionSync] Connection found for ${connectionId}`)

			// Register client for bidirectional sync on first AI message
			if (isAIMessage(message)) {
				console.log(`[VisionSync] AI message detected: ${message.type}`)
				this.aiBridge.registerClient(connectionId, connection)
			}

			// Handle AI-related messages
			if (isAIMessage(message)) {
				let response: VisionMessage

				if (message.type === "AIConversation") {
					console.log(`[VisionSync] Processing AIConversation message`)
					response = await this.aiBridge.processAIConversation(connectionId, message, connection)
				} else if (message.type === "AskResponse") {
					console.log(`[VisionSync] Processing AskResponse message: ${JSON.stringify(message.payload)}`)
					response = await this.aiBridge.processAskResponse(connectionId, message, connection)
				} else if (message.type === "TriggerSend") {
					console.log(`[VisionSync] Processing TriggerSend message`)
					response = await this.aiBridge.processTriggerSend(connectionId, message, connection)
				} else {
					console.warn(`[VisionSync] Unhandled AI message type: ${message.type}`)
					return
				}

				console.log(`[VisionSync] Sending response back to client: ${response.type}`)
				// Send response back to client
				const sent = this.websocketServer.sendMessage(connectionId, response)
				if (sent) {
					console.log(`[VisionSync] Response sent successfully`)
					this.emit(VisionServiceEvent.MESSAGE_SENT, { connectionId, message: response })
				} else {
					console.warn(`[VisionSync] Failed to send response`)
				}
			} else {
				console.log(`[VisionSync] Non-AI message type: ${message.type}`)
			}
		} catch (error) {
			console.error(`[VisionSync] Error handling message from ${connectionId}:`, error)
			this.emit(VisionServiceEvent.ERROR, {
				error: error as Error,
				context: `Message handling for ${connectionId}`,
			})
		}
	}

	/**
	 * Enhanced client disconnection handling
	 */
	private handleClientDisconnection(connectionId: string): void {
		// Unregister client from AI bridge
		this.aiBridge.unregisterClient(connectionId)
		console.log(`[VisionSync] Client ${connectionId} unregistered from AI bridge`)
	}

	/**
	 * Check if service is running
	 */
	get running(): boolean {
		return this.isRunning
	}
}
