// Ядро всей системы - отрисовка и логика

class Graph {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.two = new Two({
            fullscreen: false,
            autostart: true,
            width: this.container.clientWidth,
            height: this.container.clientHeight
        }).appendTo(this.container);

        this.mode = 'select'; // select, add, connect, delete
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.connectStart = null;
        this.snapActive = false;

        this.nodeCounter = 0;
        this.edgeCounter = 0;

        this.edgeGroup = this.two.makeGroup();
        this.nodeGroup = this.two.makeGroup();
        this.textGroup = this.two.makeGroup();

        this.edgeGroup.opacity = 1;
        this.nodeGroup.opacity = 1;
        this.textGroup.opacity = 1;

        this.propertiesPanel = document.getElementById('nodeProperties');

        this.initPropertiesPanel();
        this.setupEventListeners();
        this.updateStatusBar();
    }

    initPropertiesPanel() {
        this.nodeIdInput = document.getElementById('nodeId');
        this.nodeLabelInput = document.getElementById('nodeLabel');
        this.nodeColorPicker = document.getElementById('nodeColor');
        this.nodeColorHex = document.getElementById('nodeColorHex');
        this.nodeSizeSlider = document.getElementById('nodeSize');
        this.nodeSizeValue = document.getElementById('nodeSizeValue');
        this.nodeBorderWidthSlider = document.getElementById('nodeBorderWidth');
        this.nodeBorderWidthValue = document.getElementById('nodeBorderWidthValue');

        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shape = e.currentTarget.dataset.shape;
                this.updateNodeShape(shape);
            });
        });

        this.nodeColorPicker.addEventListener('input', (e) => {
            this.nodeColorHex.value = e.target.value;
        });

        this.nodeColorHex.addEventListener('input', (e) => {
            let value = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(value)) {
                this.nodeColorPicker.value = value;
            }
        });

        this.nodeSizeSlider.addEventListener('input', (e) => {
            this.nodeSizeValue.textContent = e.target.value;
        });

        this.nodeBorderWidthSlider.addEventListener('input', (e) => {
            this.nodeBorderWidthValue.textContent = e.target.value;
        });

        document.getElementById('applyNodeProperties').addEventListener('click', () => {
            this.applyNodeProperties();
        });

        document.getElementById('resetNodeProperties').addEventListener('click', () => {
            this.resetNodeProperties();
        });

        document.getElementById('closeProperties').addEventListener('click', () => {
            this.hidePropertiesPanel();
        });
    }

    showPropertiesPanel(node) {
        if (!node) return;

        this.propertiesPanel.classList.remove('hidden');

        this.nodeIdInput.value = node.id;
        this.nodeLabelInput.value = node.label?.value || '';

        const color = node.stroke || 'var(--main-text)';
        const hexColor = this.rgbToHex(color);
        this.nodeColorPicker.value = hexColor;
        this.nodeColorHex.value = hexColor;

        let size = 20;
        if (node.shape === 'circle') size = node.radius;
        else if (node.shape === 'square') size = node.width / 2;
        else if (node.shape === 'triangle') size = 25;
        else if (node.shape === 'diamond') size = 25;
        else if (node.shape === 'hexagon') size = 25;
        else if (node.shape === 'parallelogram') size = 25;

        this.nodeSizeSlider.value = size;
        this.nodeSizeValue.textContent = size;

        this.nodeBorderWidthSlider.value = node.linewidth;
        this.nodeBorderWidthValue.textContent = node.linewidth;

        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.shape === node.shape);
        });

        console.log('Showing panel for node:', node.id);
    }

    hidePropertiesPanel() {
        this.propertiesPanel.classList.add('hidden');
    }

    applyNodeProperties() {
        if (!this.selectedNode) return;

        const node = this.selectedNode;
        const newText = this.nodeLabelInput.value;
        const newColor = this.nodeColorPicker.value;
        const newSize = parseInt(this.nodeSizeSlider.value);
        const newLinewidth = parseInt(this.nodeBorderWidthSlider.value);

        if (node.label) {
            const x = node.position.x;
            const y = node.position.y;

            this.textGroup.remove(node.label);

            const newLabel = this.two.makeText(newText, x, y);
            newLabel.size = 14;
            newLabel.fill = newColor;
            newLabel.family = 'Jura, sans-serif';
            newLabel.weight = '600';

            node.label = newLabel;

            this.textGroup.add(newLabel);
        }

        node.stroke = newColor;
        this.updateNodeSize(node, newSize);
        node.linewidth = newLinewidth;
        this.two.update();
        this.updateStatusBar(`Свойства узла ${node.label.value} обновлены`);
    }

    resetNodeProperties() {
        if (!this.selectedNode) return;

        const originalText = this.selectedNode.label?.value || '';
        const originalColor = 'var(--main-text)';
        const originalSize = 20;
        const originalBorderWidth = 1;

        this.nodeLabelInput.value = originalText;
        this.nodeColorPicker.value = '#d4d4d4';
        this.nodeColorHex.value = '#d4d4d4';
        this.nodeSizeSlider.value = originalSize;
        this.nodeSizeValue.textContent = originalSize;
        this.nodeBorderWidthSlider.value = originalBorderWidth;
        this.nodeBorderWidthValue.textContent = originalBorderWidth;

        const currentShape = this.selectedNode.shape;
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.shape === currentShape);
        });

        this.applyNodeProperties();
    }

    updateNodeShape(shape) {
        if (!this.selectedNode) return;

        const x = this.selectedNode.position.x;
        const y = this.selectedNode.position.y;
        const id = this.selectedNode.id;
        const text = this.selectedNode.label?.value || '';
        const color = this.selectedNode.stroke;
        const linewidth = this.selectedNode.linewidth;

        console.log('Updating shape, saving text:', text);

        const connectedEdges = this.edges.filter(edge =>
            edge.start === this.selectedNode || edge.end === this.selectedNode
        );

        this.deleteNode(this.selectedNode, true);

        const newNode = this.addNode(x, y, shape, text);
        newNode.id = id;
        newNode.stroke = color;
        newNode.linewidth = linewidth;

        if (newNode.label) {
            newNode.label.fill = color;
        }

        connectedEdges.forEach(edge => {
            if (edge.start.id === id) {
                edge.start = newNode;
            }
            if (edge.end.id === id) {
                edge.end = newNode;
            }
            this.updateEdgePosition(edge);
        });

        this.selectedNode = newNode;
        this.showPropertiesPanel(newNode);
        this.two.update();
    }

    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        if (rgb.startsWith('var(')) return '#d4d4d4';

        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }

        return '#d4d4d4';
    }

    toggleSnap() {
        this.snapActive = !this.snapActive;
        this.updateToolbarButtons();
        this.updateStatusBar(`Привязка к сетке ${this.snapActive ? 'включена' : 'выключена'}`);
    }

    updateNodeSize(node, size) {
        if (node.shape === 'circle') {
            node.radius = size;
        } else if (node.shape === 'square') {
            node.width = size * 2;
            node.height = size * 2;
        } else if (node.shape === 'triangle') {
            node.scale = size / 25;
        } else if (node.shape === 'diamond') {
            node.scale = size / 25;
        } else if (node.shape === 'hexagon') {
            node.scale = size / 25;
        } else if (node.shape === 'parallelogram') {
            node.scale = size / 25;
        }
    }

    restoreConnections(nodeId, newNode) {
        this.edges.forEach(edge => {
            if (edge.start.id === nodeId) {
                edge.start = newNode;
                edge.startId = newNode.id;
            }
            if (edge.end.id === nodeId) {
                edge.end = newNode;
                edge.endId = newNode.id;
            }
        });
        this.updateAllEdges();
    }

    updateAllEdges() {
        this.edges.forEach(edge => {
            this.updateEdgePosition(edge);
        });
    }

    updateEdgePosition(edge) {
        if (!edge.start || !edge.end) return;

        edge.line.vertices[0].x = edge.start.position.x;
        edge.line.vertices[0].y = edge.start.position.y;
        edge.line.vertices[1].x = edge.end.position.x;
        edge.line.vertices[1].y = edge.end.position.y;

        if (edge.line.arrow) {
            const dx = edge.end.position.x - edge.start.position.x;
            const dy = edge.end.position.y - edge.start.position.y;
            const angle = Math.atan2(dy, dx);

            const endX = edge.end.position.x - 20 * Math.cos(angle);
            const endY = edge.end.position.y - 20 * Math.sin(angle);

            edge.line.arrow.position.x = endX;
            edge.line.arrow.position.y = endY;
            edge.line.arrow.rotation = angle + Math.PI / 2;
        }

        if (edge.label) {
            edge.label.position.x = (edge.start.position.x + edge.end.position.x) / 2;
            edge.label.position.y = (edge.start.position.y + edge.end.position.y) / 2;
        }
    }

    setupEventListeners() {
        this.two.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.two.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.two.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('resize', this.onResize.bind(this));
    }

    onResize() {
        this.two.width = this.container.clientWidth;
        this.two.height = this.container.clientHeight;
        this.two.renderer.setSize(this.two.width, this.two.height);
    }

    onMouseDown(event) {
        const rect = this.two.renderer.domElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        switch (this.mode) {
            case 'select':
                this.handleSelectModeMouseDown(x, y);
                break;
            case 'add':
                this.handleAddModeMouseDown(x, y);
                break;
            case 'connect':
                this.handleConnectModeMouseDown(x, y);
                break;
            case 'delete':
                this.handleDeleteModeMouseDown(x, y);
                break;
        }
    }

    onMouseMove(event) {
        if (this.mode === 'select' && this.dragging && this.selectedNode) {
            const rect = this.two.renderer.domElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            this.selectedNode.position.x = x - this.dragOffset.x;
            this.selectedNode.position.y = y - this.dragOffset.y;

            if (this.selectedNode.label) {
                this.selectedNode.label.position.x = this.selectedNode.position.x;
                this.selectedNode.label.position.y = this.selectedNode.position.y;
            }

            this.updateEdgesForNode(this.selectedNode);

            this.two.update();
        }
    }

    onMouseUp(event) {
        if (this.mode === 'select') {
            this.dragging = false;
            this.updateStatusBar('Режим выбора');
        }
    }

    handleSelectModeMouseDown(x, y) {
        const clickedNode = this.findNodeAtPosition(x, y);

        if (clickedNode) {
            if (this.selectedNode) {
                this.selectedNode.linewidth = 1;
                if (this.selectedNode.label) {
                    this.selectedNode.label.fill = 'var(--main-text)';
                }
            }

            this.selectedNode = clickedNode;
            this.selectedNode.linewidth = 3;
            if (this.selectedNode.label) {
                this.selectedNode.label.fill = '#ffaa00';
            }

            this.dragOffset.x = x - this.selectedNode.position.x;
            this.dragOffset.y = y - this.selectedNode.position.y;

            this.dragging = true;
            this.showPropertiesPanel(this.selectedNode);
            this.updateStatusBar(`Выбран узел ${this.selectedNode.label?.value || (this.nodes.indexOf(this.selectedNode) + 1)}`);
        } else {
            if (this.selectedNode) {
                this.selectedNode.linewidth = 1;
                if (this.selectedNode.label) {
                    this.selectedNode.label.fill = 'var(--main-text)';
                }
                this.selectedNode = null;
                this.hidePropertiesPanel();
            }
            this.updateStatusBar('Режим выбора');
        }

        this.two.update();
    }

    handleAddModeMouseDown(x, y) {
        const shape = window.currentShape || 'circle';
        this.addNode(x, y, shape);
        this.setMode('select');
        this.updateStatusBar(`Добавлен узел (${this.nodes.length})`);
    }

    handleConnectModeMouseDown(x, y) {
        const clickedNode = this.findNodeAtPosition(x, y);

        if (clickedNode) {
            if (!this.connectStart) {
                this.connectStart = clickedNode;
                this.connectStart.linewidth = 3;
                if (this.connectStart.label) {
                    this.connectStart.label.fill = '#ffaa00';
                }
                this.updateStatusBar('Выберите второй узел для связи');
            } else {
                if (this.connectStart !== clickedNode) {
                    this.addEdge(this.connectStart, clickedNode);
                }

                this.connectStart.linewidth = 1;
                if (this.connectStart.label) {
                    this.connectStart.label.fill = 'var(--main-text)';
                }
                this.connectStart = null;
                this.setMode('select');
                this.updateStatusBar('Режим выбора');
            }
        } else if (this.connectStart) {
            this.connectStart.linewidth = 1;
            if (this.connectStart.label) {
                this.connectStart.label.fill = 'var(--main-text)';
            }
            this.connectStart = null;
            this.updateStatusBar('Режим выбора');
        }

        this.two.update();
    }

    handleDeleteModeMouseDown(x, y) {
        const clickedNode = this.findNodeAtPosition(x, y);

        if (clickedNode) {
            this.deleteNode(clickedNode);
        }

        this.setMode('select');
        this.updateStatusBar('Режим выбора');
    }

    findNodeAtPosition(x, y) {
        const tolerance = 25;

        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            const dx = Math.abs(x - node.position.x);
            const dy = Math.abs(y - node.position.y);

            if (node.shape === 'circle') {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= tolerance) {
                    return node;
                }
            } else if (node.shape === 'square') {
                if (dx <= tolerance && dy <= tolerance) {
                    return node;
                }
            } else if (node.shape === 'triangle') {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= tolerance) {
                    return node;
                }
            } else if (node.shape === 'diamond') {
                const manhattanDist = Math.abs(x - node.position.x) + Math.abs(y - node.position.y);
                if (manhattanDist <= tolerance * 1.5) {
                    return node;
                }
            } else if (node.shape === 'hexagon') {
                const manhattanDist = Math.abs(x - node.position.x) + Math.abs(y - node.position.y);
                if (manhattanDist <= tolerance * 1.5) {
                    return node;
                }
            } else if (node.shape === 'parallelogram') {
                const manhattanDist = Math.abs(x - node.position.x) + Math.abs(y - node.position.y);
                if (manhattanDist <= tolerance * 1.8) {
                    return node;
                }
            }
        }
        return null;
    }

    addNode(x, y, shape = 'circle', text) {
        let node;

        switch (shape) {
            case 'circle':
                node = this.two.makeCircle(x, y, 20);
                break;
            case 'square':
                node = this.two.makeRectangle(x, y, 40, 40);
                break;
            case 'triangle':
                node = this.two.makePolygon(x, y, 25, 3);
                break;
            case 'diamond':
                node = this.two.makePolygon(x, y, 25, 4);
                node.rotation = Math.PI / 4;
                break;
            case 'hexagon':
                node = this.two.makePolygon(x, y, 25, 6);
                break;
            case 'parallelogram':
                const width = 40;
                const height = 40;
                const skew = 6;

                node = this.two.makePath(
                    x - width / 2 + skew, y - height / 2,
                    x + width / 2 + skew, y - height / 2,
                    x + width / 2 - skew, y + height / 2,
                    x - width / 2 - skew, y + height / 2
                );
                node.closed = true;
                node.fill = 'var(--main-bg)';
                break;
            default:
                node = this.two.makeCircle(x, y, 20);
        }

        node.id = crypto.randomUUID();
        node.fill = 'var(--main-bg)';
        node.stroke = 'var(--main-text)';
        node.linewidth = 1;
        node.shape = shape;

        this.nodeCounter++;
        const labelText = text || this.nodeCounter.toString();
        const label = this.two.makeText(labelText, x, y);
        label.size = 14;
        label.fill = 'var(--main-text)';
        label.family = 'Jura, sans-serif';
        label.weight = '600';
        node.label = label;

        this.nodeGroup.add(node);
        this.textGroup.add(label);
        this.nodes.push(node);

        if (this.selectedNode) {
            this.selectedNode.linewidth = 1;
            if (this.selectedNode.label) {
                this.selectedNode.label.fill = 'var(--main-text)';
            }
        }
        this.selectedNode = node;
        node.linewidth = 3;
        if (node.label) {
            node.label.fill = '#ffaa00';
        }

        this.two.update();
        return node;
    }

    deleteNode(node, keepEdges = false) {
        if (!keepEdges) {
            this.edges = this.edges.filter(edge => {
                if (edge.start === node || edge.end === node) {
                    this.edgeGroup.remove(edge.line);
                    if (edge.line.arrow) {
                        this.edgeGroup.remove(edge.line.arrow);
                    }
                    if (edge.label) {
                        this.textGroup.remove(edge.label);
                    }
                    return false;
                }
                return true;
            });
        }

        if (node.label) {
            this.textGroup.remove(node.label);
        }

        const index = this.nodes.indexOf(node);
        if (index !== -1) {
            this.nodes.splice(index, 1);
            this.nodeGroup.remove(node);
        }

        if (this.selectedNode === node) {
            this.selectedNode = null;
            this.hidePropertiesPanel();
        }

        if (this.connectStart === node) {
            this.connectStart = null;
        }

        this.two.update();
        this.updateStatusBar(`Удалён узел. Осталось: ${this.nodes.length}`);
    }

    addEdge(node1, node2, text) {
        const exists = this.edges.some(edge =>
            (edge.start === node1 && edge.end === node2) ||
            (edge.start === node2 && edge.end === node1)
        );

        if (!exists) {
            const line = this.two.makeLine(
                node1.position.x, node1.position.y,
                node2.position.x, node2.position.y
            );
            line.stroke = 'var(--main-text)';
            line.linewidth = 2;

            this.addArrowToLine(line, node1, node2);
            this.edgeCounter++;

            const midX = (node1.position.x + node2.position.x) / 2;
            const midY = (node1.position.y + node2.position.y) / 2;

            const edgeId = crypto.randomUUID();
            const labelText = text || this.edgeCounter.toString();
            const label = this.two.makeText(labelText, midX, midY);
            label.size = 12;
            label.fill = 'var(--main-text)';
            label.family = 'Jura, sans-serif';
            label.weight = '600';
            label.opacity = 0.8;
            label.background = 'var(--main-bg)';

            this.edgeGroup.add(line);
            this.textGroup.add(label);

            this.edges.push({
                id: edgeId,
                start: node1,
                end: node2,
                startId: node1.id,
                endId: node2.id,
                line: line,
                label: label
            });

            this.two.update();
            this.updateStatusBar(`Создана связь ${this.edgeCounter}`);
        }
    }

    addArrowToLine(line, startNode, endNode) {
        const dx = endNode.position.x - startNode.position.x;
        const dy = endNode.position.y - startNode.position.y;
        const angle = Math.atan2(dy, dx);
        const arrowSize = 10;
        const endX = endNode.position.x - 20 * Math.cos(angle);
        const endY = endNode.position.y - 20 * Math.sin(angle);

        const arrow = this.two.makePolygon(endX, endY, arrowSize, 3);
        arrow.rotation = angle + Math.PI / 2;
        arrow.fill = 'var(--main-text)';
        arrow.stroke = 'var(--main-text)';
        arrow.linewidth = 1;

        this.edgeGroup.add(arrow);
        line.arrow = arrow;
        return arrow;
    }

    updateEdgesForNode(node) {
        this.edges.forEach(edge => {
            if (edge.start === node || edge.end === node) {
                edge.line.vertices[0].x = edge.start.position.x;
                edge.line.vertices[0].y = edge.start.position.y;
                edge.line.vertices[1].x = edge.end.position.x;
                edge.line.vertices[1].y = edge.end.position.y;

                if (edge.line.arrow) {
                    const dx = edge.end.position.x - edge.start.position.x;
                    const dy = edge.end.position.y - edge.start.position.y;
                    const angle = Math.atan2(dy, dx);

                    const endX = edge.end.position.x - 20 * Math.cos(angle);
                    const endY = edge.end.position.y - 20 * Math.sin(angle);

                    edge.line.arrow.position.x = endX;
                    edge.line.arrow.position.y = endY;
                    edge.line.arrow.rotation = angle + Math.PI / 2;
                }

                if (edge.label) {
                    edge.label.position.x = (edge.start.position.x + edge.end.position.x) / 2;
                    edge.label.position.y = (edge.start.position.y + edge.end.position.y) / 2;
                }
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        if (mode !== 'connect' && this.connectStart) {
            this.connectStart.linewidth = 1;
            if (this.connectStart.label) {
                this.connectStart.label.fill = 'var(--main-text)';
            }
            this.connectStart = null;
        }

        this.updateToolbarButtons();

        const modeNames = {
            'select': 'Режим выбора',
            'add': 'Режим добавления',
            'connect': 'Режим связи',
            'delete': 'Режим удаления'
        };
        this.updateStatusBar(modeNames[mode]);

        this.two.update();
    }

    updateToolbarButtons() {
        const buttons = {
            'select': document.querySelector('[data-mode="select"]'),
            'add': document.getElementById('add'),
            'connect': document.getElementById('connect'),
            'delete': document.getElementById('delete'),
            //'snap': document.getElementById('snap')
        };

        if (buttons.connect) buttons.connect.classList.remove('active');

        //if (buttons.snap) buttons.snap.classList.remove('active');

        if (this.mode === 'connect' && buttons.connect) {
            buttons.connect.classList.add('active');
        }

        /*if (this.snapActive && buttons.snap) {
            buttons.snap.classList.add('active');
        }*/
    }

    updateStatusBar(message = null) {
        const statusbar = document.getElementById('statusbar');
        if (statusbar) {
            if (message) {
                statusbar.textContent = message;
            } else {
                const modeNames = {
                    'select': 'Режим выбора',
                    'add': 'Режим добавления',
                    'connect': 'Режим связи'
                };
                statusbar.textContent = modeNames[this.mode];
            }
        }
    }

    clearSelection() {
        if (this.selectedNode) {
            this.selectedNode.linewidth = 1;
            if (this.selectedNode.label) {
                this.selectedNode.label.fill = 'var(--main-text)';
            }
            this.selectedNode = null;
        }
        if (this.connectStart) {
            this.connectStart.linewidth = 1;
            if (this.connectStart.label) {
                this.connectStart.label.fill = 'var(--main-text)';
            }
            this.connectStart = null;
        }
        this.two.update();
    }

    findNodeById(id) {
        return this.nodes.find(node => node.id === id) || null;
    }

    serialize() {
        return {
            nodes: this.nodes.map(node => ({
                id: node.id,
                x: node.position.x,
                y: node.position.y,
                shape: node.shape,
                label: node.label?.value || '',
                color: node.stroke,
                linewidth: node.linewidth,
                size: node.shape === 'circle' ? node.radius :
                    node.shape === 'square' ? node.width / 2 :
                        node.shape === 'triangle' ? 25 :
                            node.shape === 'diamond' ? 25 :
                                node.shape === 'hexagon' ? 25 :
                                    node.shape === 'parallelogram' ? 25 : 20
            })),
            edges: this.edges.map(edge => ({
                id: edge.id,
                startId: edge.start.id,
                endId: edge.end.id,
                label: edge.label?.value || ''
            }))
        };
    }

    deserialize(data) {
        const nodesToDelete = [...this.nodes];
        nodesToDelete.forEach(node => this.deleteNode(node));

        const nodeMap = new Map();

        data.nodes.forEach(nodeData => {
            const node = this.addNode(
                nodeData.x,
                nodeData.y,
                nodeData.shape,
                nodeData.label
            );
            node.id = nodeData.id;
            node.stroke = nodeData.color;
            node.linewidth = nodeData.linewidth;
            this.updateNodeSize(node, nodeData.size);
            nodeMap.set(nodeData.id, node);
        });

        data.edges.forEach(edgeData => {
            const startNode = nodeMap.get(edgeData.startId);
            const endNode = nodeMap.get(edgeData.endId);

            if (startNode && endNode) {
                const edge = this.addEdge(startNode, endNode, edgeData.label);

                if (edge && edgeData.id) {
                    const createdEdge = this.edges.find(e =>
                        e.start === startNode && e.end === endNode
                    );
                    if (createdEdge) {
                        createdEdge.id = edgeData.id;
                        if (createdEdge.label && edgeData.label) {
                            createdEdge.label.value = edgeData.label;
                        }
                    }
                }
            }
        });

        this.two.update();
    }

    async saveToFile() {
        try {
            const data = this.serialize();
            const result = await window.electron.saveFile(data);

            if (result.success) {
                this.updateStatusBar(`Граф сохранён в ${result.path}`);
            } else if (!result.canceled) {
                this.updateStatusBar('Ошибка при сохранении файла');
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.updateStatusBar(`Ошибка: ${error.message}`);
        }
    }

    async loadFromFile() {
        try {
            const result = await window.electron.loadFile();

            if (result.success) {
                const data = JSON.parse(result.content);
                this.deserialize(data);
                this.updateStatusBar(`Граф загружен из ${result.path}`);
            } else if (!result.canceled) {
                this.updateStatusBar('Ошибка при загрузке файла');
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.updateStatusBar(`Ошибка: ${error.message}`);
        }
    }

    // Экспериментальная функция
    exportToMermaid() {
        let mermaid = 'graph TD\n';
        this.edges.forEach(edge => {
            mermaid += `    ${edge.start.label.value} --> ${edge.end.label.value}\n`;
        });
        return mermaid;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.graph = new Graph('graphCanvas');
    window.currentShape = 'circle';

    const addButton = document.getElementById('add');
    const connectButton = document.getElementById('connect');
    const deleteButton = document.getElementById('delete');
    const saveButton = document.getElementById('save');
    const loadButton = document.getElementById('load');
    //const snapButton = document.getElementById('snap');

    connectButton.replaceWith(connectButton.cloneNode(true));
    const newConnectButton = document.getElementById('connect');

    addButton.addEventListener('click', () => {
        window.graph.setMode('add');
        const modal = document.getElementById('nodeShapeModal');
        modal.style.display = 'flex';
    });

    newConnectButton.addEventListener('click', () => {
        if (window.graph.mode === 'connect') {
            window.graph.setMode('select');
        } else {
            window.graph.clearSelection();
            window.graph.setMode('connect');
        }
    });

    deleteButton.addEventListener('click', () => {
        if (window.graph.selectedNode) {
            window.graph.deleteNode(window.graph.selectedNode);
        } else {
            window.graph.setMode('delete');
            window.graph.updateStatusBar('Кликните на узел для удаления');
        }
    });

    saveButton.addEventListener('click', async () => {
        await window.graph.saveToFile();
    });

    loadButton.addEventListener('click', async () => {
        await window.graph.loadFromFile();
    });

    /*snapButton.addEventListener('click', () => {
        window.graph.toggleSnap();
    });*/

    document.querySelectorAll('.shape-option').forEach(option => {
        option.addEventListener('click', () => {
            const shape = option.dataset.shape;
            window.currentShape = shape;

            option.style.transform = 'scale(0.95)';
            setTimeout(() => {
                option.style.transform = '';
            }, 150);

            setTimeout(() => {
                const modal = document.getElementById('nodeShapeModal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }, 200);
        });
    });

    const modal = document.getElementById('nodeShapeModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            window.graph.setMode('select');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            window.graph.setMode('select');
        }
    });
});