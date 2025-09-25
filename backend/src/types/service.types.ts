/**
 * Service State Enumeration
 * 
 * Defines the possible states a service can be in during its lifecycle.
 */
export enum ServiceState {
  /** Service instance created but not yet initialized */
  CREATED = 'created',
  /** Service is being initialized and dependencies are being resolved */
  INITIALIZING = 'initializing',
  /** Service is fully initialized and ready to handle requests */
  READY = 'ready',
  /** Service failed to initialize or encountered a critical error */
  ERROR = 'error',
  /** Service is being gracefully shut down */
  SHUTTING_DOWN = 'shutting_down',
  /** Service has been completely cleaned up and is no longer available */
  DESTROYED = 'destroyed'
}

/**
 * Service Interface
 * 
 * Defines the contract that all services must implement.
 */
export interface IService {
  /** Unique service name for identification and dependency resolution */
  readonly name: string;
  /** Current service state in the lifecycle */
  readonly state: ServiceState;
  /** Initialize the service */
  initialize(): Promise<void>;
  /** Destroy the service */
  destroy(): Promise<void>;
  /** Check if service is ready */
  isReady(): boolean;
  /** Get service health status */
  getHealth(): { healthy: boolean; details?: Record<string, unknown> };
}
