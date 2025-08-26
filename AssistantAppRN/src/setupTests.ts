// Jest setup file for testing
import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {});

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/FontAwesome', () => 'Icon');
jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');
jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('react-native-vector-icons/Entypo', () => 'Icon');
jest.mock('react-native-vector-icons/AntDesign', () => 'Icon');
jest.mock('react-native-vector-icons/EvilIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Foundation', () => 'Icon');
jest.mock('react-native-vector-icons/Octicons', () => 'Icon');
jest.mock('react-native-vector-icons/SimpleLineIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Zocial', () => 'Icon');
jest.mock('react-native-vector-icons/Fontisto', () => 'Icon');

// Mock Blob for tests
global.Blob = class MockBlob {
  constructor(content: any[], options?: any) {
    this.content = content;
    this.options = options;
  }
  
  content: any[];
  options?: any;
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }
  
  text() {
    return Promise.resolve('');
  }
  
  stream() {
    return new ReadableStream();
  }
} as any;

// Mock FormData for tests
global.FormData = class MockFormData {
  private data: Map<string, any> = new Map();
  
  append(key: string, value: any, filename?: string) {
    this.data.set(key, { value, filename });
  }
  
  get(key: string) {
    return this.data.get(key);
  }
  
  has(key: string) {
    return this.data.has(key);
  }
  
  delete(key: string) {
    this.data.delete(key);
  }
  
  getAll(key: string) {
    return [this.data.get(key)];
  }
  
  entries() {
    return this.data.entries();
  }
  
  keys() {
    return this.data.keys();
  }
  
  values() {
    return this.data.values();
  }
  
  forEach(callback: (value: any, key: string, parent: FormData) => void) {
    this.data.forEach((value, key) => callback(value, key, this));
  }
} as any;
