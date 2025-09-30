# ADR-0002: Encryption Service Extraction

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Development Team

## Context

The application currently uses a static `CryptoUtil` class for token encryption/decryption. This approach has several limitations:

1. **Static State**: Encryption key is stored as static class property
2. **Initialization Issues**: Key initialization happens on import, making testing difficult
3. **No Service Integration**: Not integrated with the service architecture
4. **Limited Functionality**: Basic encryption/decryption without advanced features
5. **Testing Challenges**: Difficult to mock and test encryption functionality

## Decision

We will extract the encryption functionality into a dedicated `EncryptionService` that:

1. **Extends BaseService**: Integrates with the service architecture
2. **Manages Encryption Key**: Handles key initialization and rotation
3. **Provides Advanced Features**: Key rotation, health checks, statistics
4. **Maintains Backward Compatibility**: Legacy `CryptoUtil` delegates to the service
5. **Supports Testing**: Can be easily mocked and tested

## Consequences

### Positive

- **Service Integration**: Encryption is now part of the service architecture
- **Better Testing**: Service can be mocked and tested independently
- **Key Management**: Proper key initialization and rotation support
- **Health Monitoring**: Built-in health checks and statistics
- **Backward Compatibility**: Existing code continues to work
- **Error Handling**: Consistent error handling with other services
- **Lifecycle Management**: Proper initialization and shutdown

### Negative

- **Additional Complexity**: More code and abstractions
- **Service Dependency**: Other services now depend on EncryptionService
- **Initialization Order**: Must be initialized before services that use encryption

### Neutral

- **Performance**: Minimal overhead from service abstraction
- **Memory Usage**: Slight increase due to service instance

## Alternatives Considered

1. **Keep Static CryptoUtil**: Continue using static class
   - Rejected due to testing and integration issues

2. **Direct Service Usage**: Remove CryptoUtil entirely
   - Rejected due to breaking changes and migration effort

3. **Hybrid Approach**: Keep CryptoUtil but make it configurable
   - Rejected due to complexity and limited benefits

## Implementation Notes

- `EncryptionService` extends `BaseService` and implements `IService`
- Legacy `CryptoUtil` methods delegate to the service instance
- Service is registered early in the initialization process
- Key rotation functionality is implemented but not yet used
- Health checks include key status and service state

## Related ADRs

- [ADR-0001: Service Layer Architecture](./0001-service-architecture.md)

## References

- [EncryptionService Implementation](../../src/services/encryption.service.ts)
- [Legacy CryptoUtil](../../src/utils/crypto.util.ts)
- [Service Initialization](../../src/services/service-initialization.ts)
