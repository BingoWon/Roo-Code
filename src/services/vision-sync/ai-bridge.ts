/**
 * VisionSync AI Bridge - Complete Task Integration
 * Provides full Roo Code task management for visionOS clients
 */

import { EventEmitter } from "events"
import type { ClineProvider } from "../../core/webview/ClineProvider"
import type { ClineMessage, Task as TaskType } from "@roo-code/types"
import { RooCodeEventName } from "@roo-code/types"
import type {
	VisionMessage,
	AIConversationMessage,
	AskResponseMessage,
	TriggerSendMessage,
	VisionConnection,
} from "./types"
import { MessageFactory } from "./message-utils"
import { VISION_SYNC_CONSTANTS } from "./constants"

interface VisionClient {
	readonly connectionId: string
	readonly connection: VisionConnection
	readonly connectedAt: Date
	lastActivity: Date
	syncedMessageCount: number
	currentTaskId?: string
	sessionId?: string
}

export class VisionAIBridge extends EventEmitter {
	private provider: ClineProvider | null = null
	private clients = new Map<string, VisionClient>()
	private taskListeners = new Map<string, (messageEvent: { action: string; message: ClineMessage }) => void>()

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
	 * Process AI conversation message from visionOS with complete task integration
	 */
	async processAIConversation(
		connectionId: string,
		message: AIConversationMessage,
		connection: VisionConnection,
	): Promise<VisionMessage> {
		try {
			const { sessionId, role, content } = message.payload
			this.updateClientActivity(connectionId)

			// Update client session tracking
			const client = this.clients.get(connectionId)
			if (client) {
				client.sessionId = sessionId
			}

			console.log(
				`[VisionAIBridge] Processing ${role} message from ${connection.clientType}: "${content.substring(0, 50)}..."`,
			)

			if (role === "user") {
				// Create or continue task with full Roo Code integration
				const taskResult = await this.createOrContinueTask(connectionId, content, sessionId)

				return MessageFactory.aiConversation(
					sessionId,
					"assistant",
					taskResult.success ? "Task initiated successfully" : `Error: ${taskResult.error}`,
					{
						type: taskResult.success ? "task_created" : "error",
						originalMessageId: message.id,
						taskId: taskResult.taskId,
					},
				)
			} else {
				// Handle assistant/system messages (for conversation sync)
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
	 * Process ask response message from visionOS
	 */
	async processAskResponse(
		connectionId: string,
		message: AskResponseMessage,
		connection: VisionConnection,
	): Promise<VisionMessage> {
		try {
			const { sessionId, askResponse, text, images } = message.payload

			console.log(`[VisionAIBridge] Processing ask response: ${askResponse} for session ${sessionId}`)

			// Directly handle the ask response through the current task
			// This bypasses the webview UI and directly calls the task's handleWebviewAskResponse method
			const currentTask = this.provider?.getCurrentTask()
			if (currentTask) {
				console.log(`[VisionAIBridge] Current task found: ${currentTask.taskId}`)
				console.log(`[VisionAIBridge] Task askResponse state BEFORE: ${currentTask.askResponse}`)
				console.log(`[VisionAIBridge] Task lastMessageTs: ${currentTask.lastMessageTs}`)

				// Check if task is actually waiting for a response
				const isWaitingForResponse = currentTask.askResponse === undefined
				console.log(`[VisionAIBridge] Task is waiting for response: ${isWaitingForResponse}`)

				currentTask.handleWebviewAskResponse(askResponse as any, text, images)

				console.log(`[VisionAIBridge] Task askResponse state AFTER: ${currentTask.askResponse}`)
				console.log(`[VisionAIBridge] Ask response handled successfully: ${askResponse}`)
			} else {
				console.warn(`[VisionAIBridge] No current task found to handle ask response: ${askResponse}`)
			}

			return MessageFactory.aiConversation(sessionId, "assistant", "Ask response processed", {
				type: "ask_response_result",
				success: true,
				askResponse,
				originalMessageId: message.id,
			})
		} catch (error) {
			console.error("[VisionAIBridge] Error processing ask response:", error)

			return MessageFactory.aiConversation(
				message.payload.sessionId,
				"assistant",
				`Error processing ask response: ${error instanceof Error ? error.message : "Unknown error"}`,
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
		this.provider.on(RooCodeEventName.TaskCreated, (task: any) => {
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
	private setupTaskMessageListener(task: any): void {
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
	 * Convert ClineMessage to VisionSync format with enhanced task context
	 */
	private convertClineMessageToVision(clineMessage: ClineMessage): VisionMessage | null {
		try {
			// Use client's session ID if available, fallback to current-session
			const sessionId = this.getActiveSessionId() || "current-session"

			// Enhanced role mapping
			let role: "user" | "assistant" | "system" = "assistant"
			if (clineMessage.type === "ask") {
				role = "user"
			} else if (clineMessage.say === "text" || clineMessage.say === "completion_result") {
				role = "assistant"
			} else if (clineMessage.say === "error" || clineMessage.say === "tool") {
				role = "system"
			}

			const content = clineMessage.text || ""
			if (!content.trim()) return null

			// Enhanced metadata for better task tracking
			// For streaming messages, use a consistent messageId based on timestamp and type
			const baseMessageId = `${clineMessage.ts}`
			const metadata = {
				timestamp: clineMessage.ts,
				messageId: baseMessageId,
				source: "roo-code",
				originalType: clineMessage.type,
				...(clineMessage.say && { sayType: clineMessage.say }),
				...(clineMessage.ask && { askType: clineMessage.ask }),
				...(this.provider?.getCurrentTask()?.taskId && { taskId: this.provider.getCurrentTask()?.taskId }),
			}

			// Create message with partial support for streaming
			const baseMessage = MessageFactory.aiConversation(sessionId, role, content, metadata, clineMessage.partial)

			// Create enhanced VisionMessage with streaming support
			const visionMessage = {
				...baseMessage,
				isStreaming: clineMessage.partial === true,
				isFinal: clineMessage.partial !== true,
				streamId: clineMessage.id || baseMessage.id,
				chunkIndex: 0,
			}

			return visionMessage
		} catch (error) {
			console.error("[VisionAIBridge] Error converting message:", error)
			return null
		}
	}

	/**
	 * Get active session ID from connected clients
	 */
	private getActiveSessionId(): string | null {
		for (const client of this.clients.values()) {
			if (client.sessionId) {
				return client.sessionId
			}
		}
		return null
	}

	/**
	 * Create or continue task with complete Roo Code integration
	 */
	private async createOrContinueTask(
		connectionId: string,
		content: string,
		sessionId: string,
	): Promise<{ success: boolean; taskId?: string; error?: string }> {
		if (!this.provider) {
			return { success: false, error: "Roo Code provider not available" }
		}

		try {
			const client = this.clients.get(connectionId)
			const currentTask = this.provider.getCurrentTask()

			// Check if client has an active task
			if (client?.currentTaskId && currentTask?.taskId === client.currentTaskId) {
				// Continue existing task
				currentTask.handleWebviewAskResponse("messageResponse", content, [])
				return { success: true, taskId: currentTask.taskId }
			} else {
				// Create new task with optimal configuration
				const task = await this.provider.createTask(content, [], undefined, {
					consecutiveMistakeLimit: VISION_SYNC_CONSTANTS.TASK.CONSECUTIVE_MISTAKE_LIMIT,
				})

				if (task) {
					// Update client tracking
					if (client) {
						client.currentTaskId = task.taskId
					}

					console.log(`[VisionAIBridge] Created new task ${task.taskId} for client ${connectionId}`)
					return { success: true, taskId: task.taskId }
				} else {
					return { success: false, error: "Failed to create task due to policy restrictions" }
				}
			}
		} catch (error) {
			console.error("[VisionAIBridge] Error in task management:", error)
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}
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
