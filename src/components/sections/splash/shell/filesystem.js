import React from 'react';
import { longestCommonPrefix } from '../../../../services/utils';

const NODE_TYPE = {
    DIR: 'dir',
    FILE: 'file',
    EXE: 'exe'
};

const PATH = [
    '/.bin'
];

class FileSystemNode {
    constructor(type, name) {
        this.type = type;
        this.name = name;
        this.parent = null;
    }

    getDisplayPath() {
        if (!this._displayPath) {
            const path = [];
            let node = this;
            do {
                if (node === HOME) {
                    path.push('~');
                    break;
                }
                path.push(node.name);
                node = node.parent;
            } while (node);
            this._displayPath = path.reverse().join('/') || '/';
        }
        return this._displayPath;
    }

    getAbsolutePath() {
        if (!this._absolutePath) {
            const path = [this.name];
            let node = this.parent;
            while (node) {
                path.push(node.name);
                node = node.parent;
            }
            this._absolutePath = path.reverse().join('/') || '/';
        }
        return this._absolutePath;
    }
}

class DirNode extends FileSystemNode {
    constructor(name, children=[]) {
        super(NODE_TYPE.DIR, name);
        this.children = children;
        for (const child of children) {
            child.parent = this;
        }
    }
}

class FileNode extends FileSystemNode {
    constructor(name, content) {
        super(NODE_TYPE.FILE, name);
        this.content = content;
    }

    toString() {
        return this.content;
    }
}

class ExeNode extends FileSystemNode {
    constructor(name, program) {
        super(NODE_TYPE.EXE, name);
        this.program = program;
    }

    toString() {
        return this.program.toString();
    }
}

const PROGRAMS = {
    pwd(args, fs, out) {
        out.print(fs.wd.getAbsolutePath());
    },

    la(args, fs, out) {
        let node = fs.wd;
        if (args && args[0]) {
            let resolvedNode = fs.resolve(args[0]);
            if (!resolvedNode) {
                out.sys(`ls: ${args[0]}: No such file or directory`);
                return;
            }
            if (resolvedNode.type !== NODE_TYPE.DIR) {
                out.print(args[0]);
                return;
            }
            node = resolvedNode;
        }
        out.print(node.children
            .map(child => child.name)
            .join('\u00A0\u00A0'));
    },

    ls(args, fs, out) {
        let node = fs.wd;
        if (args && args[0]) {
            let resolvedNode = fs.resolve(args[0]);
            if (!resolvedNode) {
                out.sys(`ls: ${args[0]}: No such file or directory`);
                return;
            }
            if (resolvedNode.type !== NODE_TYPE.DIR) {
                out.print(args[0]);
                return;
            }
            node = resolvedNode;
        }
        out.print(node.children
            .filter(child => !child.name.startsWith('.'))
            .map(child => child.name)
            .join('\u00A0\u00A0'));
    },

    cd(args, fs, out) {
        const target = args[0] || '~';
        const node = fs.resolve(target);
        if (!node) {
            out.sys(`cd: ${target}: No such file or directory`);
            return;
        }
        if (node.type !== NODE_TYPE.DIR) {
            out.sys(`cd: ${target}: Not a directory`);
            return;
        }
        fs.wd = node;
    },

    cat(args, fs, out) {
        const target = args[0];
        if (!target) {
            out.sys(`cat: No target`);
        }
        const node = fs.resolve(target);
        if (!node) {
            out.sys(`cat: ${target}: No such file or directory`);
            return;
        }
        if (node.type === NODE_TYPE.DIR) {
            out.sys(`cat: ${target}: Is a directory`);
            return;
        }
        out.print(node.toString());
    },

    echo(args, fs, out) {
        out.print(args.join(' '));
    },

    clear(args, fs, out) {
        out.clear();
    },

    reset(args, fs, out) {
        out.reset();
    }
};

const HOME = new DirNode('guest', [
    new DirNode('about'),
    new DirNode('experience'),
    new DirNode('projects'),
    new FileNode(
        'README.md',
        [
            'Hello',
            <b key="b">Dillon Yao</b>,
            'There'
        ]
    )
]);

const ROOT = new DirNode('', [
    new DirNode('.bin', Object.entries(PROGRAMS).map(([name, program]) => new ExeNode(name, program))),
    new DirNode('Users', [
        HOME,
    ])
]);

class FileSystem {
    constructor() {
        this.root = ROOT;
        this.home = this.wd = HOME;
    }

    getLocationString() {
        return this.wd.getDisplayPath();
    }

    resolveProgram(programName) {
        for (const path of PATH) {
            const fileNode = this.resolve(`${path}/${programName}`);
            if (fileNode && (fileNode.type === NODE_TYPE.EXE)) {
                if (fileNode.type === NODE_TYPE.EXE) {
                    return fileNode.program;
                }
            }
        }
        const programNode = this.resolve(programName);
        if (programNode && programNode.type === NODE_TYPE.EXE) {
            return programNode.program;
        }
    }

    resolve(path) {
        const tokens = path.split('/');
        let node = this.wd;
        if (path.startsWith('/')) {
            node = this.root;
        } else if (path.startsWith('~')) {
            node = this.home;
            tokens.shift();
        }
        for (const token of tokens) {
            if (token === '' || token === '.') {
                continue;
            } else if (token === '..') {
                if (node.parent) {
                    node = node.parent;
                }
                continue;
            }
            let success = false;
            for (const child of node.children) {
                if (child.name === token) {
                    success = true;
                    node = child;
                    break;
                }
            }
            if (!success) {
                return null;
            }
        }
        return node;
    }

    autoResolveProgram(name) {
        for (const path of PATH) {
            const possibilities = this._getPossibilities(`${path}/${name}`);
            if (possibilities.length === 1 && possibilities[0].type === NODE_TYPE.EXE) {
                return `${possibilities[0].name} `;
            }
            const lcp = longestCommonPrefix(possibilities.map(node => node.name));
            if (lcp) return lcp;
        }
        return null;
    }

    autoResolvePath(path) {
        const possibilities = this._getPossibilities(path);
        if (possibilities.length === 1) {
            const resolved = possibilities[0];
            return resolved.type === NODE_TYPE.DIR ? `${resolved.name}/` : `${resolved.name} `;
        }
        return longestCommonPrefix(possibilities.map(node => node.name));
    }

    getProgramPossibilities(name) {
        const allPossible = [];
        for (const path of PATH) {
            const possibilities = this._getPossibilities(`${path}/${name}`);
            allPossible.push(...possibilities);
        }
        return allPossible;
    }

    getPathPossibilities(path) {
        return this._getPossibilities(path).map(node => node.name);
    }

    _getPossibilities(path) {
        const tokens = path.split('/');
        const toComplete = tokens.pop();
        let subPath = tokens.join('/');
        if (path.startsWith('/')) {
            subPath = `/${subPath}`
        }
        const node = this.resolve(subPath);
        if (!node) {
            return [];
        }
        const possibilities = [];
        for (const child of node.children) {
            if (child.name.startsWith(toComplete)) {
                possibilities.push(child);
            }
        }
        return possibilities;
    }
}



export default FileSystem;