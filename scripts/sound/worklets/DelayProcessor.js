class DelayProcessor extends KillableWorkletProcessor
{
    static MAX_DELAY_TIME = 5; // seconds

    static get parameterDescriptors() 
    {
        return [
            { name: "bypass",   automationRate: "a-rate", defaultValue: 0,  minValue: 0, maxValue: 1 },
            { name: "time",     automationRate: "a-rate", defaultValue: 0,  minValue: 0, maxValue: DelayProcessor.MAX_DELAY_TIME },
            { name: "feedback", automationRate: "a-rate", defaultValue: 0,  minValue: 0, maxValue: 1 },
            { name: "mix",      automationRate: "a-rate", defaultValue: 0,  minValue: 0, maxValue: 1 }
        ];
    }

    constructor(_options)
    {
        super();

        const maxChannels = _options.outputChannelCount[0];

        const delayLineLength = DelayProcessor.MAX_DELAY_TIME * sampleRate;

        this.buffer = new Array(maxChannels);
        this.writeIndex = new Uint32Array(maxChannels);

        for (let c = 0; c < maxChannels; ++c)
            this.buffer[c] = new Float32Array(delayLineLength);
    }

    process(inputs, outputs, parameters) 
    {
        const input = inputs[0];
        const output = outputs[0];

        const bypass = parameters.bypass;
        const time = parameters.time;
        const feedback = parameters.feedback;
        const mix = parameters.mix;

        for (let c = 0; c < input.length; ++c) {
            const inputChannel = input[c];
            const outputChannel = output[c];

            for (let s = 0; s < inputChannel.length; ++s) {
                // Copy the input to the output
                outputChannel[s] = inputChannel[s];

                // Read a sample from the delay line
                const delayOut = this.read(c, (time[s] ?? time[0]));

                // Write a sample (with feedback) to the delay line
                const delayIn = inputChannel[s] + (delayOut * (feedback[s] ?? feedback[0]));
                this.write(c, delayIn);

                // Check bypass state
                if ((bypass[s] ?? bypass[0]))
                    continue;

                // Mix the delayed and original samples
                const m = (mix[s] ?? mix[0]);
                
                outputChannel[s] *= (1 - m);
                outputChannel[s] += (delayOut * m);
            }
        }

        return this.keepAlive;
    }

    read(_channel, _time)
    {
        const delayInFrames = _time * sampleRate;

        let index1 = (this.writeIndex[_channel] - ~~delayInFrames);
        let index2 = (index1 - 1);
    
        while (index1 < 0)
            index1 += this.buffer[_channel].length;
    
        while (index2 < 0)
            index2 += this.buffer[_channel].length;
    
        const frac = delayInFrames - ~~delayInFrames;
    
        const samp1 = this.buffer[_channel][index1];
        const samp2 = this.buffer[_channel][index2];
    
        return samp1 + (samp2 - samp1) * frac;
    }

    write(_channel, _sample)
    {
        ++this.writeIndex[_channel];
        this.writeIndex[_channel] %= this.buffer[_channel].length;
        
        this.buffer[_channel][this.writeIndex[_channel]] = _sample;
    }
}

registerProcessor("delay-processor", DelayProcessor);
