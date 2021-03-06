import React, {Component} from 'react';
import FileSystem from './filesystem';
import './shell.css';

const SHELL_CONFIG = {
    USER: 'guest',
    HOST: 'dillonyao.tk',
    SYS_MSG: '-yaoshell',
    SYS_PROMPT: '>',
    SYS_ERR: '(!)',
    V_MAJOR: 0,
    V_MINOR: 2,
    V_PATCH: 0
};

class LineBuffer {
    constructor() {
        this.sentinel = { value: '' };
        this.clearContent();
    }

    clearContent() {
        this.sentinel.prev = this.sentinel.next = this.sentinel;
        this.cursor = this.sentinel;
    }

    setContent(content) {
        this.clearContent();
        for (const c of content) {
            this.pushChar(c);
        }
    }

    toString() {
        const content = [];
        let curr_node = this.sentinel;
        do {
            content.push(curr_node.value);
            curr_node = curr_node.next;
        } while (curr_node !== this.sentinel);
        return content.join('');
    }

    pushChar(c) {
        const node = {
            value: c,
            prev: this.cursor,
            next: this.cursor.next,
        };
        node.prev.next = node;
        node.next.prev = node;
        this.cursor = node;
    }

    popChar() {
        const cursor = this.cursor;
        cursor.prev.next = cursor.next;
        cursor.next.prev = cursor.prev;
        this.cursor = cursor.prev;
    }

    incrementCursor() {
        if (this.cursor.next !== this.sentinel) {
            this.cursor = this.cursor.next;
        }
    }

    decrementCursor() {
        if (this.cursor !== this.sentinel) {
            this.cursor = this.cursor.prev;
        }
    }
}

class InputLine extends Component {
    constructor(props) {
        super(props);
        this.history = [];
        this.head = 0;
        const buffer = new LineBuffer();
        this.bufferChain = { buffer };
        this.state = {
            inputValue: buffer.toString(),
            currentBuffer: buffer
        };
        window.addEventListener('keydown', this._handleKeydown)
    }

    render() {
        return (
            <shln>
                <o>{SHELL_CONFIG.USER}</o>
                @
                <b>{SHELL_CONFIG.HOST}</b>
                {`:${this.props.path}> ${this.state.inputValue}`}
            </shln>
        );
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this._handleKeydown);
    }

    _clearBuffer() {
        const buffer = new LineBuffer();
        this.bufferChain = { buffer };
        this.setState({
            inputValue: buffer.toString(),
            currentBuffer: buffer
        })
    }

    _consume() {
        const output = this.state.currentBuffer.toString();
        if (output) {
            this.history.push(output);
            this.head = this.history.length;
        }
        this._clearBuffer();
        this.props.parse(output);
    }

    _nextBuffer() {
        if (this.bufferChain.next) {
            this.head += 1;
            this.bufferChain = this.bufferChain.next;
            this.bufferChain.buffer.cursor = this.bufferChain.buffer.sentinel.prev;
            this.setState({
                inputValue: this.bufferChain.buffer.toString(),
                currentBuffer: this.bufferChain.buffer
            });
        }
    }

    _lastBuffer() {
        let update = false;
        if (this.bufferChain.prev) {
            this.head -= 1;
            this.bufferChain = this.bufferChain.prev;
            this.bufferChain.buffer.cursor = this.bufferChain.buffer.sentinel.prev;
            update = true;
        } else if (this.head > 0) {
            this.head -= 1;
            const lastBuffer = new LineBuffer();
            const historyEntry = this.history[this.head];
            lastBuffer.setContent(historyEntry);
            const chainNode = {
                buffer: lastBuffer,
                next: this.bufferChain
            };
            this.bufferChain.prev = chainNode;
            this.bufferChain = chainNode;
            this.bufferChain.buffer.cursor = this.bufferChain.buffer.sentinel.prev;
            update = true;
        }
        if (update) {
            this.setState({
                inputValue: this.bufferChain.buffer.toString(),
                currentBuffer: this.bufferChain.buffer
            });
        }
    }

    _handleKeydown = (e) => {
        if (e.metaKey) {
            return;
        }

        const key = e.key;
        const buffer = this.state.currentBuffer;
        let shouldUpdate = false;

        if (key.length === 1) {
            buffer.pushChar(key);
            shouldUpdate = true;
        } else if (key === 'Enter') {
            this._consume();
        } else if (key === 'Tab') {

        } else if (key === 'ArrowLeft') {
            buffer.decrementCursor();
            shouldUpdate = true;
        } else if (key === 'ArrowRight') {
            const buffer = this.state.currentBuffer;
            buffer.incrementCursor();
            shouldUpdate = true;
        } else if (key === 'ArrowUp') {
            this._lastBuffer();
        } else if (key === 'ArrowDown') {
            this._nextBuffer();
        } else if (key === 'Backspace') {
            buffer.popChar();
            shouldUpdate = true;
        }

        if (key === ' ') {
            e.preventDefault();
        }

        if (shouldUpdate) {
            this.setState({
                inputValue: buffer.toString(),
            });
        }
    };
}


class Shell extends Component {
    constructor(props) {
        super(props);
        this.lines = [];
        this.fs = new FileSystem();
        this.out = {
            print: (line) => this.print(line),
            sys: (line) => this.sys(line),
            clear: () => this.clear(),
            reset: () => this.reset()
        };
        this.state = { shouldUpdate: true };
    }

    componentDidMount() {
        this.parse('cat README.md');
    }

    render() {
        return (
            <div
                className="shell"
                ref={$ => this.$ = $}
                key={this.i}
            >
                {this.lines}
                <InputLine
                    path={this.fs.getLocationString()}
                    parse={ (line) => this.parse(line) }
                />
            </div>
        );
    }

    componentDidUpdate() {
        this.$.scrollTop = this.$.scrollHeight;
    }

    parse(line) {
        const path = this.fs.getLocationString();
        const output = (
            <shln key={this.lines.length}>
                <o>{SHELL_CONFIG.USER}</o>@<b>{SHELL_CONFIG.HOST}</b>:{path}> {line}
            </shln>
        );
        this.lines.push(output);

        if (line) {
            const tokens = line.split(' ').filter(Boolean);
            const programName = tokens.shift();
            const program = this.fs.resolveProgram(programName);
            if (program) {
                program(tokens, this.fs, this.out);
            } else {
                this.sys(`${programName}: command not found`);
            }
        }
        this.setState({ shouldUpdate: true });
    }

    print(line) {
        this.lines.push(<shln key={this.lines.length}>{line}</shln>);
        this.setState({ shouldUpdate: true });
    }

    sys(msg) {
        this.lines.push(<shln key={this.lines.length}><sys>{SHELL_CONFIG.SYS_MSG}: </sys>{msg}</shln>)
    }

    clear() {
        this.lines = [];
        this.setState({ shouldUpdate: true });
    }

    reset() {
        this.lines = [];
        this.fs = new FileSystem();
        this.setState({shouldUpdate: true});
        this.componentDidMount();
    }
}

export default Shell;