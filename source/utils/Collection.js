export class Collection extends Map {
    first(amount) {
        if (amount === undefined) {
            return this.values().next().value;
        }
        if (amount < 0) {
            return this.last(amount * -1);
        }
        amount = Math.min(this.size, amount);
        const iter = this.values();
        return Array.from({ length: amount }, () => iter.next().value);
    }

    last(amount) {
        const arr = [...this.values()];
        if (amount === undefined) {
            return arr[arr.length - 1];
        }
        if (amount < 0) {
            return this.first(amount * -1);
        }
        if (!amount) {
            return [];
        }
        return arr.slice(-amount);
    }

    random(amount) {
        const arr = [...this.values()];
        if (amount === undefined) {
            return arr[Math.floor(Math.random() * arr.length)];
        }
        if (!arr.length || !amount) {
            return [];
        }
        return Array.from({ length: Math.min(amount, arr.length) }, () => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }

    find(fn) {
        for (const [key, val] of this) {
            if (fn(val, key, this)) {
                return val;
            }
        }
        return undefined;
    }

    filter(fn) {
        const results = new Collection();
        for (const [key, val] of this) {
            if (fn(val, key, this)) {
                results.set(key, val);
            }
        }
        return results;
    }

    map(fn) {
        const results = [];
        for (const [key, val] of this) {
            results.push(fn(val, key, this));
        }
        return results;
    }

    some(fn) {
        for (const [key, val] of this) {
            if (fn(val, key, this)) {
                return true;
            }
        }
        return false;
    }

    every(fn) {
        for (const [key, val] of this) {
            if (!fn(val, key, this)) {
                return false;
            }
        }
        return true;
    }

    reduce(fn, initialValue) {
        let accumulator = initialValue;
        for (const [key, val] of this) {
            accumulator = fn(accumulator, val, key, this);
        }
        return accumulator;
    }

    each(fn) {
        this.forEach((val, key) => fn(val, key, this));
        return this;
    }

    tap(fn) {
        fn(this);
        return this;
    }

    clone() {
        return new Collection(this);
    }

    concat(...collections) {
        const newColl = this.clone();
        for (const coll of collections) {
            for (const [key, val] of coll) {
                newColl.set(key, val);
            }
        }
        return newColl;
    }

    equals(collection) {
        if (!collection) {
            return false;
        }
        if (this === collection) {
            return true;
        }
        if (this.size !== collection.size) {
            return false;
        }
        for (const [key, value] of this) {
            if (!collection.has(key) || value !== collection.get(key)) {
                return false;
            }
        }
        return true;
    }

    sort(compareFunction = Collection.defaultSort) {
        const entries = [...this.entries()];
        entries.sort((a, b) => compareFunction(a[1], b[1], a[0], b[0]));
        super.clear();
        for (const [key, val] of entries) {
            super.set(key, val);
        }
        return this;
    }

    intersect(other) {
        const coll = new Collection();
        for (const [key, val] of other) {
            if (this.has(key)) {
                coll.set(key, val);
            }
        }
        return coll;
    }

    difference(other) {
        const coll = new Collection();
        for (const [key, val] of other) {
            if (!this.has(key)) {
                coll.set(key, val);
            }
        }
        for (const [key, val] of this) {
            if (!other.has(key)) {
                coll.set(key, val);
            }
        }
        return coll;
    }

    toJSON() {
        return [...this.values()];
    }

    static defaultSort(firstValue, secondValue) {
        return Number(firstValue > secondValue) || Number(firstValue === secondValue) - 1;
    }
}
