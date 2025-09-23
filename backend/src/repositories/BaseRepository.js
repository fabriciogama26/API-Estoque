class BaseRepository {
  constructor(entityName) {
    this.entityName = entityName;
    this.items = new Map();
  }

  create(entity) {
    this.items.set(entity.id, entity);
    return entity;
  }

  findById(id) {
    return this.items.get(id) || null;
  }

  findAll() {
    return Array.from(this.items.values());
  }

  update(id, changes) {
    const current = this.items.get(id);
    if (!current) {
      return null;
    }
    const updated = { ...current, ...changes };
    this.items.set(id, updated);
    return updated;
  }

  delete(id) {
    return this.items.delete(id);
  }
}

module.exports = BaseRepository;



