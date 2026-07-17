export class StorageAdapter {
  async init() { throw new Error('StorageAdapter.init must be implemented'); }
  async get() { throw new Error('StorageAdapter.get must be implemented'); }
  async list() { throw new Error('StorageAdapter.list must be implemented'); }
  async create() { throw new Error('StorageAdapter.create must be implemented'); }
  async update() { throw new Error('StorageAdapter.update must be implemented'); }
  async softDelete() { throw new Error('StorageAdapter.softDelete must be implemented'); }
  async restore() { throw new Error('StorageAdapter.restore must be implemented'); }
  async remove() { throw new Error('StorageAdapter.remove must be implemented'); }
  async transaction() { throw new Error('StorageAdapter.transaction must be implemented'); }
  async exportDatabase() { throw new Error('StorageAdapter.exportDatabase must be implemented'); }
  async importDatabase() { throw new Error('StorageAdapter.importDatabase must be implemented'); }
  async resetDatabase() { throw new Error('StorageAdapter.resetDatabase must be implemented'); }
}

