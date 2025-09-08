/**
 * VisionSync AI Bridge - Modern Bidirectional Message Sync
 * Provides seamless conversation sync between Roo Code and visionOS
 */

import { EventEmitter } from "events"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { ClineMessage, Task } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"
import type { VisionMessage, AIConversationMessage, TriggerSendMessage, VisionConnection } from "./types"
import { MessageFactory } from "./message-utils"

interface VisionClient {
	readonly connectionId: string
	readonly connection: VisionConnection
	readonly connectedAt: Date
	lastActivity: Date
	syncedMessageCount: number
}

export class VisionAIBridge extends EventEmitter {
	private provider: ClineProvider | null = null
	private clients = new Map<string, VisionClient>()
	private taskListeners = new Map<string, () => void>()

	constructor() {
		super()
	}

	/**
	 * Initialize with Roo Code provider and setup bidirectional sync
	 */
	initialize(provider: ClineProvider): void {
		this.provider = provider
		this.setupRooCodeMessageListener()
		console.log("[VisionAIBridge] Initialized with bidirectional sync")
	}

	/**
	 * Register a visionOS client for bidirectional sync
	 */
	registerClient(connectionId: string, connection: VisionConnection): void {
		const client: VisionClient = {
			connectionId,
			connection,
			connectedAt: new Date(),
			lastActivity: new Date(),
			syncedMessageCount: 0,
		}

		this.clients.set(connectionId, client)
		console.log(`[VisionAIBridge] Client registered: ${connectionId} (${connection.clientType})`)

		// Send current conversation history to new client
		this.syncConversationHistory(connectionId)
	}

	/**
	 * Unregister a visionOS client
	 */
	unregisterClient(connectionId: string): void {
		this.clients.delete(connectionId)
		console.log(`[VisionAIBridge] Client unregistered: ${connectionId}`)
	}

	/**
	 * Process AI conversation message from visionOS
	 */
	async processAIConversation(
		connectionId: string,
		message: AIConversationMessage,
		connection: VisionConnection,
	): Promise<VisionMessage> {
		try {
			const { sessionId, role, content } = message.payload
			this.updateClientActivity(connectionId)

			console.log(
				`[VisionAIBridge] Processing message from ${connection.clientType}: "${content.substring(0, 50)}..."`,
			)

			if (role === "user") {
				// Send user message to Roo Code
				await this.sendUserMessageToRooCode(content)

				// Return acknowledgment (actual AI response will come via message listener)
				return MessageFactory.aiConversation(
					sessionId,
					"assistant",
					"Message sent to Roo Code AI. Processing...",
					{
						type: "acknowledgment",
						originalMessageId: message.id,
					},
				)
			} else {
				// Handle non-user messages
				return MessageFactory.aiConversation(sessionId, "assistant", "Message received", {
					type: "acknowledgment",
					originalMessageId: message.id,
				})
			}
		} catch (error) {
			console.error("[VisionAIBridge] Error processing AI conversation:", error)

			return MessageFactory.aiConversation(
				message.payload.sessionId,
				"assistant",
				`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
				{
					type: "error",
					originalMessageId: message.id,
				},
			)
		}
	}

	/**
	 * Process trigger send message from visionOS
	 */
	async processTriggerSend(
		connectionId: string,
		message: TriggerSendMessage,
		connection: VisionConnection,
	): Promise<VisionMessage> {
		try {
			const { sessionId, action } = message.payload

			console.log(`[VisionAIBridge] Processing trigger send: ${action} for session ${sessionId}`)

			if (action === "send") {
				// Trigger the send action in Roo Code
				const result = await this.triggerRooCodeSend(sessionId)

				return MessageFactory.aiConversation(
					sessionId,
					"assistant",
					result.success ? "Send action triggered successfully" : `Send action failed: ${result.error}`,
					{
						type: "trigger_send_result",
						success: result.success,
						error: result.error,
						originalMessageId: message.id,
					},
				)
			} else if (action === "cancel") {
				// Cancel any ongoing operations
				const result = await this.cancelRooCodeOperation(sessionId)

				return MessageFactory.aiConversation(
					sessionId,
					"assistant",
					result.success ? "Operation cancelled successfully" : `Cancel failed: ${result.error}`,
					{
						type: "cancel_result",
						success: result.success,
						error: result.error,
						originalMessageId: message.id,
					},
				)
			} else {
				throw new Error(`Unknown trigger action: ${action}`)
			}
		} catch (error) {
			console.error("[VisionAIBridge] Error processing trigger send:", error)

			return MessageFactory.aiConversation(
				message.payload.sessionId,
				"assistant",
				`Error processing trigger: ${error instanceof Error ? error.message : "Unknown error"}`,
				{
					type: "error",
					error: error instanceof Error ? error.message : "Unknown error",
					originalMessageId: message.id,
				},
			)
		}
	}

	/**
	 * Setup Roo Code message listener for bidirectional sync
	 */
	private setupRooCodeMessageListener(): void {
		if (!this.provider) return

		// Listen for new tasks
		this.provider.on(RooCodeEventName.TaskCreated, (task: Task) => {
			this.setupTaskMessageListener(task)
		})

		// Setup listener for current task if exists
		const currentTask = this.provider.getCurrentTask()
		if (currentTask) {
			this.setupTaskMessageListener(currentTask)
		}
	}

	/**
	 * Setup message listener for a specific task
	 */
	private setupTaskMessageListener(task: Task): void {
		const taskId = task.taskId

		// Remove existing listener if any
		const existingListener = this.taskListeners.get(taskId)
		if (existingListener) {
			task.off(RooCodeEventName.Message, existingListener)
		}

		// Create new listener
		const messageListener = (messageEvent: { action: string; message: ClineMessage }) => {
			if (messageEvent.action === "created" || messageEvent.action === "updated") {
				this.broadcastMessageToVisionClients(messageEvent.message)
			}
		}

		// Register listener
		task.on(RooCodeEventName.Message, messageListener)
		this.taskListeners.set(taskId, messageListener)

		console.log(`[VisionAIBridge] Message listener setup for task: ${taskId}`)
	}

	/**
	 * Process trigger send message from visionOS
	 */
	async processTriggerSend(
		connectionId: string,
		message: TriggerSendMessage,
		connection: VisionConnection,
	): Promise<VisionMessage> {
		try {
			const { sessionId, action } = message.payload
			this.updateClientActivity(connectionId)

			console.log(`[VisionAIBridge] Processing trigger: ${action}`)

			if (action === "send") {
				// Trigger send in Roo Code
				await this.provider?.postMessageToWebview({
					type: "invoke",
					invoke: "primaryButtonClick",
				})

				return MessageFactory.aiConversation(sessionId, "assistant", "Send action triggered", {
					type: "trigger_result",
					success: true,
					originalMessageId: message.id,
				})
			} else if (action === "cancel") {
				// Cancel current operation
				await this.provider?.postMessageToWebview({
					type: "cancelTask",
				})

				return MessageFactory.aiConversation(sessionId, "assistant", "Operation cancelled", {
					type: "cancel_result",
					success: true,
					originalMessageId: message.id,
				})
			} else {
				throw new Error(`Unknown action: ${action}`)
			}
		} catch (error) {
			console.error("[VisionAIBridge] Error processing trigger:", error)

			return MessageFactory.aiConversation(
				message.payload.sessionId,
				"assistant",
				`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
				{
					type: "error",
					originalMessageId: message.id,
				},
			)
		}
	}

	/**
	 * Broadcast Roo Code message to all connected visionOS clients
	 */
	private broadcastMessageToVisionClients(clineMessage: ClineMessage): void {
		if (this.clients.size === 0) return

		const visionMessage = this.convertClineMessageToVision(clineMessage)
		if (!visionMessage) return

		console.log(`[VisionAIBridge] Broadcasting message to ${this.clients.size} clients`)

		this.clients.forEach((client) => {
			this.emit("messageForClient", {
				connectionId: client.connectionId,
				message: visionMessage,
			})
		})
	}

	/**
	 * Convert ClineMessage to VisionSync format
	 */
	private convertClineMessageToVision(clineMessage: ClineMessage): VisionMessage | null {
		try {
			const sessionId = "current-session"
			const role = clineMessage.type === "ask" ? "user" : "assistant"
			const content = clineMessage.text || ""

			if (!content.trim()) return null

			return MessageFactory.aiConversation(sessionId, role, content, {
				timestamp: clineMessage.ts,
				messageId: `${clineMessage.ts}`,
				source: "roo-code",
				originalType: clineMessage.type,
			})
		} catch (error) {
			console.error("[VisionAIBridge] Error converting message:", error)
			return null
		}
	}

	/**
	 * Send user message to Roo Code
	 */
	private async sendUserMessageToRooCode(content: string): Promise<void> {
		if (!this.provider) {
			throw new Error("Roo Code provider not available")
		}

		try {
			// Send message to current task or create new task
			const currentTask = this.provider.getCurrentTask()

			if (currentTask) {
				// Continue existing conversation
				await this.provider.postMessageToWebview({
					type: "askResponse",
					askResponse: "messageResponse",
					text: content,
					images: [],
				})
			} else {
				// Create new task
				await this.provider.postMessageToWebview({
					type: "newTask",
					text: content,
					images: [],
				})
			}
		} catch (error) {
			console.error("[VisionAIBridge] Error sending message to Roo Code:", error)
			throw error
		}
	}

	/**
	 * Sync conversation history to a specific client
	 */
	private syncConversationHistory(connectionId: string): void {
		if (!this.provider) return

		const currentTask = this.provider.getCurrentTask()
		if (!currentTask) return

		const messages = currentTask.clineMessages
		console.log(`[VisionAIBridge] Syncing ${messages.length} messages to client ${connectionId}`)

		messages.forEach((message) => {
			const visionMessage = this.convertClineMessageToVision(message)
			if (visionMessage) {
				this.emit("messageForClient", {
					connectionId,
					message: visionMessage,
				})
			}
		})
	}

	/**
	 * Update client activity
	 */
	private updateClientActivity(connectionId: string): void {
		const client = this.clients.get(connectionId)
		if (client) {
			client.lastActivity = new Date()
		}
	}

	/**
	 * Get connected clients
	 */
	getConnectedClients(): VisionClient[] {
		return Array.from(this.clients.values())
	}

	/**
	 * Cleanup resources
	 */
	cleanup(): void {
		// Remove all task listeners
		this.taskListeners.forEach((listener, taskId) => {
			// Note: We can't remove listeners without task reference
			// This is handled when tasks are destroyed
		})
		this.taskListeners.clear()
		this.clients.clear()
	}
}
