import { ENTITY_STORES } from './constants.mjs';

export class AdminState {
  constructor(storage) {
    this.storage = storage;
    this.data = Object.fromEntries(ENTITY_STORES.map((name) => [name, []]));
    this.listeners = new Set();
    this.loaded = false;
  }

  async load() {
    const entries = await Promise.all(ENTITY_STORES.map(async (name) => [name, await this.storage.list(name)]));
    this.data = Object.fromEntries(entries);
    this.loaded = true;
    this.emit();
    return this.data;
  }

  async refresh(...stores) {
    const targets = stores.length ? stores : ENTITY_STORES;
    for (const name of targets) this.data[name] = await this.storage.list(name);
    this.emit();
    return this.data;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) listener(this);
  }

  get(store, id) {
    return this.data[store]?.find((record) => record.id === id);
  }

  by(store, field, value) {
    return this.data[store]?.filter((record) => record[field] === value) || [];
  }

  clientName(id) {
    return this.get('clients', id)?.name || 'Клиент не указан';
  }

  vehicleName(id) {
    const vehicle = this.get('vehicles', id);
    return vehicle ? `${vehicle.make} ${vehicle.model}${vehicle.year ? `, ${vehicle.year}` : ''}` : 'Автомобиль не указан';
  }
}
