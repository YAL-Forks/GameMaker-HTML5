class LPF2Processor extends KillableWorkletProcessor
{
    static get parameterDescriptors() 
    {
        const maxCutoff = Math.min(sampleRate / 2, 20000);

        return [
            { name: "bypass", automationRate: "a-rate", defaultValue: 0,         minValue: 0,  maxValue: 1 },
            { name: "cutoff", automationRate: "a-rate", defaultValue: maxCutoff, minValue: 10, maxValue: maxCutoff },
            { name: "q",      automationRate: "a-rate", defaultValue: 1,         minValue: 1,  maxValue: 100 }
        ];
    }

    constructor(_options)
    {
        super();

        const maxChannels = _options.outputChannelCount[0];

        this.a1 = 0;
        this.a2 = 0;
        this.b0 = 0;
        this.b1 = 0;
        this.b2 = 0;

        this.x1 = new Float32Array(maxChannels);
        this.x2 = new Float32Array(maxChannels);
        this.y1 = new Float32Array(maxChannels);
        this.y2 = new Float32Array(maxChannels);

        this.prevCutoff = -1;
        this.prevQ = -1;
    }

    process(inputs, outputs, parameters) 
    {
        const input = inputs[0];
        const output = outputs[0];

        const bypass = parameters.bypass;
        const cutoff = parameters.cutoff;
        const q = parameters.q;

        const paramsAreConstant = (cutoff.length === 1 && q.length === 1);

        if (paramsAreConstant)
            this.calcCoefficients(cutoff[0], q[0]);

        for (let c = 0; c < input.length; ++c) {
            const inputChannel = input[c];
            const outputChannel = output[c];

            for (let s = 0; s < inputChannel.length; ++s) {
                // Recalc coefficients if needed
                if (!paramsAreConstant)
                    this.calcCoefficients(cutoff[s] ?? cutoff[0], q[s] ?? q[0]);

                // Calculate the new sample
                const y0 = this.b0 * inputChannel[s]
                         + this.b1 * this.x1[c]
                         + this.b2 * this.x2[c]
                         - this.a1 * this.y1[c]
                         - this.a2 * this.y2[c];

                // Shift the original samples
                this.x2[c] = this.x1[c];
                this.x1[c] = inputChannel[s];
    
                // Shift the filtered samples
                this.y2[c] = this.y1[c];
                this.y1[c] = y0;

                // Write the original/filtered sample to the output
                outputChannel[s] = (bypass[s] ?? bypass[0]) ? inputChannel[s] : y0;
            }
        }

        return this.keepAlive;
    }

    calcCoefficients(_cutoff, _q)
    {
        if (_cutoff === this.prevCutoff && _q === this.prevQ)
            return;

        const w0 = 2 * Math.PI * _cutoff / sampleRate;

        const alpha = Math.sin(w0) / (2 * _q);
        const cos_w0 = Math.cos(w0);
    
        const a0 = 1 + alpha;
        const a1 = -2 * cos_w0;
        const a2 = 1 - alpha;
    
        const b0 = (1 - cos_w0) / 2;
        const b1 = 1 - cos_w0;
        const b2 = (1 - cos_w0) / 2;
    
        this.a1 = a1 / a0;
        this.a2 = a2 / a0;
        this.b0 = b0 / a0;
        this.b1 = b1 / a0;
        this.b2 = b2 / a0;

        this.prevCutoff = _cutoff;
        this.prevQ = _q;
    }
}

registerProcessor("lpf2-processor", LPF2Processor);
