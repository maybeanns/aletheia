import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Import the original client
import prisma from '../prisma';

// Mock the module
jest.mock('../prisma', () => ({
    __esModule: true,
    default: mockDeep<PrismaClient>(),
}));

// Export the mock and Original
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
    mockReset(prismaMock);
});
