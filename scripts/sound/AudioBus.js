function AudioBus() {
	// GML object props
	this.__type = "[AudioBus]";
	this.__yyIsGMLObject = true;

	this.inputNode = g_WorkletNodeManager.createBusInput(this);
	this.outputNode = g_WorkletNodeManager.createBusOutput(this);
	
	this.inputNode.connect(this.outputNode, 0, 0); // Initial effect chain connection
	this.inputNode.connect(this.outputNode, 1, 1); // Bypass connection

	this.bypass = false;
	this.gain = 1.0;
	this.effects = Array(AudioBus.NUM_EFFECT_SLOTS).fill(undefined);
	this.nodes = Array(AudioBus.NUM_EFFECT_SLOTS).fill(undefined);

	this.proxy = new Proxy(this.effects, {
		set: (_target, _property, _value, _receiver) => {
			const propAsInt = parseInt(_property);

			if (this.isNodeIndex(propAsInt))
				this.handleConnections(propAsInt, this.handleValue(_value));
			
			_target[_property] = _value;
		}
	});

	// Define user-facing properties
	Object.defineProperties(this, {
		gmlbypass: {
			enumerable: true,
			get: () => {
				return this.bypass;
			},
			set: (_state) => {
				this.bypass = yyGetBool(_state);

				const bypass = this.inputNode.parameters.get("bypass");
				bypass.value = this.bypass;
			}
		},        
		gmlgain: {
			enumerable: true,
			get: () => {
				return this.gain; 
			},
			set: (_gain) => {
				this.gain = max(0.0, _gain);

				const gain = this.outputNode.parameters.get("gain");
				gain.setTargetAtTime(this.gain, 0, AudioEffect.PARAM_TIME_CONSTANT);
			}
		},
		gmleffects: {
			enumerable: true,
			get: () => {
				return this.proxy;
			},
			set: (_effects) => {}
		}
	});
}

AudioBus.NUM_EFFECT_SLOTS = 8;

AudioBus.prototype.connectInput = function(_source, _outputIndex, _inputIndex)
{
	_source.connect(this.inputNode, _outputIndex, _inputIndex);
};

AudioBus.prototype.connectOutput = function(_destination, _outputIndex, _inputIndex)
{
	this.outputNode.connect(_destination, _outputIndex, _inputIndex);
};

AudioBus.prototype.findNextNode = function(_idx)
{
	const nodes = this.nodes.slice(_idx + 1, AudioBus.NUM_EFFECT_SLOTS);
	const nextNode = nodes.find((_node) => _node !== undefined);

	return nextNode ?? this.outputNode;
};

AudioBus.prototype.findPrevNode = function(_idx) 
{
	const nodes = this.nodes.slice(0, _idx);
	const prevNode = nodes.findLast((_node) => _node !== undefined);

	return prevNode ?? this.inputNode;
};

AudioBus.prototype.handleConnections = function(_idx, _newNode)
{
	const currentNode = this.nodes[_idx];

	if (currentNode === undefined && _newNode === undefined)
		return; // No need to change anything

	const prevNode = this.findPrevNode(_idx);
	const nextNode = this.findNextNode(_idx);

	// Disconnect the previous node
	if (currentNode !== undefined)
	{
		prevNode.disconnect(currentNode);

		currentNode.disconnect();
		this.effects[_idx].removeNode(currentNode);
	}
	else
	{
		prevNode.disconnect(nextNode, 0, 0);
	}

	// Reconnect the previous node (and any new node)
	if (_newNode === undefined)
	{
		prevNode.connect(nextNode, 0, 0);
	}
	else
	{
		prevNode.connect(_newNode, 0, 0);
		_newNode.connect(nextNode, 0, 0);
	}

	this.nodes[_idx] = _newNode;
};

AudioBus.prototype.handleValue = function(_value)
{
	if (_value instanceof AudioEffectStruct)
		return _value.addNode();

	if (_value === undefined)
		return _value;

	throw new Error("Value must be Struct.AudioEffect or undefined");
};

AudioBus.prototype.isNodeIndex = function(_prop)
{
	if (_prop >= 0 && _prop < AudioBus.NUM_EFFECT_SLOTS)
		return true;

	return false;
};
