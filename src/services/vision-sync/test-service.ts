/**
 * VisionSync Service Test
 * Simple test to verify the service works correctly
 */

import { VisionSyncService, VisionServiceEvent, MessageFactory } from "./index"

async function testVisionSyncService() {
	console.log("🧪 Testing VisionSync Service...")

	// Create service instance
	const service = new VisionSyncService({
		serviceName: "TestRooCode",
		port: 8765,
		discoveryPort: 8766,
		enabled: true,
		maxConnections: 5,
	})

	// Set up event listeners
	service.on(VisionServiceEvent.SERVICE_STARTED, (data) => {
		console.log("✅ Service started:", data)
	})

	service.on(VisionServiceEvent.SERVICE_STOPPED, () => {
		console.log("✅ Service stopped")
	})

	service.on(VisionServiceEvent.CLIENT_CONNECTED, (data) => {
		console.log("✅ Client connected:", data.connection.id, data.connection.clientType)
	})

	service.on(VisionServiceEvent.CLIENT_DISCONNECTED, (data) => {
		console.log("✅ Client disconnected:", data.connectionId)
	})

	service.on(VisionServiceEvent.MESSAGE_RECEIVED, (data) => {
		console.log("✅ Message received:", data.message.type, "from", data.connectionId)
	})

	service.on(VisionServiceEvent.ERROR, (data) => {
		console.error("❌ Service error:", data.error.message)
	})

	try {
		// Start the service
		await service.start()
		console.log("🚀 Service started successfully")

		// Get service status
		const status = service.getStatus()
		console.log("📊 Service status:", {
			running: status.running,
			websocketPort: status.websocketPort,
			discoveryPort: status.discoveryPort,
			connections: status.connections.length,
		})

		// Get network info
		const networkInfo = service.getNetworkInfo()
		console.log("🌐 Network info:", networkInfo)

		// Test message creation
		const testMessage = MessageFactory.aiConversation("test-session-123", "user", "Hello from test!", {
			test: true,
		})
		console.log("💬 Test message created:", testMessage.type, testMessage.id)

		// Wait a bit to see if everything is working
		console.log("⏳ Waiting 5 seconds...")
		await new Promise((resolve) => setTimeout(resolve, 5000))

		// Stop the service
		await service.stop()
		console.log("🛑 Service stopped successfully")

		console.log("✅ All tests passed!")
	} catch (error) {
		console.error("❌ Test failed:", error)

		// Make sure to stop the service even if there's an error
		try {
			await service.stop()
		} catch (stopError) {
			console.error("❌ Error stopping service:", stopError)
		}
	}
}

// Run the test if this file is executed directly
if (require.main === module) {
	testVisionSyncService().catch(console.error)
}

export { testVisionSyncService }
