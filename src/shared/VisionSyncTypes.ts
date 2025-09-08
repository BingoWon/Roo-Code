/**
 * VisionSync Settings Types
 * Shared types for VisionSync configuration and status
 */

export interface VisionSyncSettings {
	enabled: boolean
	port: number
	discoveryPort: number
	serviceName: string
	maxConnections: number
}

export interface VisionSyncStatus {
	running: boolean
	config: VisionSyncSettings | null
	connections: Array<{
		id: string
		clientType: string
		version: string
		connectedAt: string
	}>
	networkInfo?: {
		localIP: string
		networkSegment: string
		interfaceName: string
		isOnline: boolean
	}
	websocketPort?: number
	discoveryPort?: number
}
