// Variable to store the selected MIDI output port
let midiOutput = null;

// Variable to store the original text of the MIDI status element
let originalMidiStatusText = '';

// --- MIDI CC numbers for parameters (JT Mini) ---

// Global / Modulation
const CC_MODULATION = 1;

// VCO (Voltage Controlled Oscillator)
const CC_VCO_PWM_MODULATION = 36;
const CC_VCO_DETUNE = 42;
const CC_VCO_PITCH_MODULATION = 47;

// LFO (Low Frequency Oscillator)
const CC_LFO_DELAY_TIME = 37;
const CC_LFO_RATE = 46;

// Voice and Octave Controls
const CC_VOICE_MODE = 40;
const CC_OCTAVE = 41;

// Filter (VCF)
const CC_VCF_CUTOFF = 44;
const CC_VCF_ENVELOPE_MODULATION = 45;
const CC_VCF_LFO_MODULATION = 48;

// Envelope (ADSR)
const CC_ENVELOPE_ATTACK = 49;
const CC_ENVELOPE_DECAY = 50;
const CC_ENVELOPE_SUSTAIN = 51;
const CC_ENVELOPE_RELEASE = 39;

// --- INIT PATCH DEFAULTS (Used by Init and Random functions) ---
const ALL_PATCH_CONTROLS = [
    // Global / Modulation
    { id: 'modulation', cc: CC_MODULATION, value: 0 },

    // VCO (Voltage Controlled Oscillator)
    { id: 'vco-pwm-modulation', cc: CC_VCO_PWM_MODULATION, value: 0 },
    { id: 'vco-detune', cc: CC_VCO_DETUNE, value: 64 }, // Center
    { id: 'vco-pitch-modulation', cc: CC_VCO_PITCH_MODULATION, value: 0 },

    // LFO (Low Frequency Oscillator)
    { id: 'lfo-delay-time', cc: CC_LFO_DELAY_TIME, value: 0 },
    { id: 'lfo-rate', cc: CC_LFO_RATE, value: 64 }, // Center

    // Voice and Octave Controls
    { id: 'voice-mode', cc: CC_VOICE_MODE, value: 6 }, // Voice Mode Poly (0-12 range)
    { id: 'octave', cc: CC_OCTAVE, value: 54 }, // Octave 8' (44-65 range)

    // Filter (VCF)
    { id: 'vcf-cutoff', cc: CC_VCF_CUTOFF, value: 80 },
    { id: 'vcf-envelope-modulation', cc: CC_VCF_ENVELOPE_MODULATION, value: 64 }, // Center
    { id: 'vcf-lfo-modulation', cc: CC_VCF_LFO_MODULATION, value: 0 },

    // Envelope (ADSR)
    { id: 'envelope-attack', cc: CC_ENVELOPE_ATTACK, value: 0 },
    { id: 'envelope-decay', cc: CC_ENVELOPE_DECAY, value: 0 },
    { id: 'envelope-sustain', cc: CC_ENVELOPE_SUSTAIN, value: 127 },
    { id: 'envelope-release', cc: CC_ENVELOPE_RELEASE, value: 0 }
];

// --- Random number generator: Get a random integer between min (inclusive) and max (inclusive)
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- INIT PATCH FUNCTION ---
function initPatch() {
    console.log("Initializing patch...");

    ALL_PATCH_CONTROLS.forEach(param => {
        const element = document.getElementById(param.id);
        if (element) {
            let midiValue = param.value;
            
            if (param.isCheckbox) {
                // For Checkboxes, 0 is off (false)
                element.checked = (param.value === 127);
            } else {
                // For Sliders
                element.value = param.value;
            }
            
            // Send the MIDI CC message
            sendMidiCC(param.cc, midiValue);
        }
    });

    console.log("Patch initialized and MIDI messages sent.");
}

// --- RANDOM PATCH FUNCTION ---
function randomPatch() {
    console.log("Generating random patch...");
    ALL_PATCH_CONTROLS.forEach(param => {
        const element = document.getElementById(param.id);
        if (element) {
            let minValue = 0; // Default min
            let maxValue = 127; // Default max
            
            let randomValue;
            let midiValue;
            
            if (param.isCheckbox) {
                // Randomly set checkbox On/Off (0 or 127)
                // 1 in 3 chance of being ON (127)
                randomValue = getRandomInt(0, 2) === 2 ? 127 : 0;
                element.checked = (randomValue === 127);
                midiValue = randomValue;
            } else {
                // Random value for sliders
                randomValue = getRandomInt(minValue, maxValue);
                element.value = randomValue;
                midiValue = randomValue;
            }
            
            sendMidiCC(param.cc, midiValue);
        }
    });
    console.log("Random patch generated and MIDI messages sent.");
}

// --- INITIALIZATION ---
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
}

// --- FAILURE HANDLER ---
function onMIDIFailure() {
    console.log("Could not access your MIDI devices.");
    // Use the new status element for the error message
    const statusElement = document.getElementById('midi-device-status-text');
    if (statusElement) {
        statusElement.textContent = 'ERROR: Could not access MIDI devices.';
        statusElement.style.color = 'red';
    }
}

// --- SUCCESS HANDLER (MAIN LOGIC) ---
function onMIDISuccess(midiAccess) {
    // 1. Initialize the MIDI Output list on load
    populateOutputDevices(midiAccess);
    
    // 2. Add listeners for device hot-plugging
    midiAccess.addEventListener('statechange', () => populateOutputDevices(midiAccess));

    // 3. Add event listener to the dropdown for user selection
    document.getElementById('midi-output-select').addEventListener('change', (event) => {
        connectToSelectedOutput(event.target.value, midiAccess);
    });

    // 4. Attach INIT PATCH button listener
    const initButton = document.getElementById('init-patch-button');
    if (initButton) {
        initButton.addEventListener('click', initPatch);
    }

    // 5. Attach RANDOM PATCH button listener
    const randomButton = document.getElementById('random-patch-button');
    if (randomButton) {
        randomButton.addEventListener('click', randomPatch);
    }

    // 6. Attach all parameter listeners
    
    // Helper to attach listeners to all continuous sliders
    const attachSliderListener = (ccNumber, elementId) => {
        const slider = document.getElementById(elementId);
        const statusElement = document.getElementById('midi-output-select');
        if (slider && statusElement) {
            // 1. Find the associated label text. 
            const labelElement = document.querySelector(`label[for="${elementId}"]`);
            // Use the label text (trimmed and capitalized), or the element ID as a fallback.
            const labelText = labelElement ? labelElement.textContent.trim().toUpperCase() : elementId.toUpperCase();
            
            // 1. Mouse Down: Store the original status text and clear it
            slider.addEventListener('mousedown', () => {
                // Must access the global originalMidiStatusText variable
                originalMidiStatusText = statusElement.options[statusElement.selectedIndex].textContent;
                statusElement.options[statusElement.selectedIndex].textContent = '';
            });

            // 2. Input: Send MIDI, console.log, and update the display
            slider.addEventListener('input', (event) => {
                const ccValue = parseInt(event.target.value);
                sendMidiCC(ccNumber, ccValue);
                
                // Format the display text (e.g., MODULATION: 64)
                const displayText = `${labelText}: ${ccValue}`;
                
                // Console log (retained from previous steps)
                console.log(`CC ${ccNumber} (${elementId}): Value ${ccValue}`);
                
                // Temporarily display the text in the select box
                statusElement.options[statusElement.selectedIndex].textContent = displayText;
            });

            // 3. Mouse Up: Restore the original status text
            slider.addEventListener('mouseup', () => {
                statusElement.options[statusElement.selectedIndex].textContent = originalMidiStatusText;
            });
        }
    };
    
    // Global / Modulation
    attachSliderListener(CC_MODULATION, 'modulation');

    // VCO (Voltage Controlled Oscillator)
    attachSliderListener(CC_VCO_PWM_MODULATION, 'vco-pwm-modulation');
    attachSliderListener(CC_VCO_DETUNE, 'vco-detune');
    attachSliderListener(CC_VCO_PITCH_MODULATION, 'vco-pitch-modulation');

    // LFO (Low Frequency Oscillator)
    attachSliderListener(CC_LFO_DELAY_TIME, 'lfo-delay-time');
    attachSliderListener(CC_LFO_RATE, 'lfo-rate');

    // Voice and Octave Controls
    attachSliderListener(CC_VOICE_MODE, 'voice-mode');
    attachSliderListener(CC_OCTAVE, 'octave');

    // Filter (VCF)
    attachSliderListener(CC_VCF_CUTOFF, 'vcf-cutoff');
    attachSliderListener(CC_VCF_ENVELOPE_MODULATION, 'vcf-envelope-modulation');
    attachSliderListener(CC_VCF_LFO_MODULATION, 'vcf-lfo-modulation');

    // Envelope (ADSR)
    attachSliderListener(CC_ENVELOPE_ATTACK, 'envelope-attack');
    attachSliderListener(CC_ENVELOPE_DECAY, 'envelope-decay');
    attachSliderListener(CC_ENVELOPE_SUSTAIN, 'envelope-sustain');
    attachSliderListener(CC_ENVELOPE_RELEASE, 'envelope-release');
}

// --- HELPER FUNCTION: POPULATE DROPDOWN ---
function populateOutputDevices(midiAccess) {
    const select = document.getElementById('midi-output-select');
    const currentId = select.value; 
    select.innerHTML = ''; 

    if (midiAccess.outputs.size === 0) {
        const option = document.createElement('option');
        option.value = '';
        // The default text should be in the option for the initial state
        option.textContent = '-- No Devices Found --'; 
        select.appendChild(option);
        midiOutput = null;
        return;
    }

    let foundSelection = false;
    let autoSelectId = null;

    // First pass: Find if a previous selection or the JT Mini exists
    midiAccess.outputs.forEach((output) => {
        if (output.id === currentId) {
            autoSelectId = output.id;
        } else if (output.name.includes("JT Mini")) {
            autoSelectId = output.id;
        }
    });

    // Second pass: Populate the list and set selection
    midiAccess.outputs.forEach((output) => {
        const option = document.createElement('option');
        option.value = output.id;
        option.textContent = output.name;
        select.appendChild(option);

        if (output.id === autoSelectId) {
            option.selected = true;
            foundSelection = true;
        }
    });
    
    // If no device was selected after populating, set the first one as selected
    if (!foundSelection && midiAccess.outputs.size > 0) {
        select.options[0].selected = true;
    }

    // Connect to the device that is now selected (either found or the first one)
    connectToSelectedOutput(select.value, midiAccess);
}

// --- HELPER FUNCTION: HANDLE CONNECTION ---
function connectToSelectedOutput(portId, midiAccess) {
    if (portId) {
        midiOutput = midiAccess.outputs.get(portId);
        console.log(`Now connected to: ${midiOutput.name}`);
        // Update the status text to show the connected device name (in case it wasn't already selected)
        const select = document.getElementById('midi-output-select');
        select.options[select.selectedIndex].textContent = midiOutput.name;
    } else {
        midiOutput = null;
        console.log("No valid MIDI output selected.");
    }
}

// --- HELPER FUNCTION: SEND MIDI CC ---
function sendMidiCC(ccNumber, value) {
    if (midiOutput) {
        const midiMessage = [0xB0, ccNumber, value];
        midiOutput.send(midiMessage);
        // console.log(`Sent CC ${ccNumber} with value ${value}`); // Commented out to reduce console spam
    } else {
        // console.log("MIDI output device not selected. Cannot send message.");
    }
}

// --- HAMBURGER MENU LOGIC ---
const hamburger = document.getElementById('hamburger-menu');
const sideNav = document.getElementById('side-nav');
const closeBtn = document.getElementById('close-btn');
const aboutBtn = document.getElementById('about-btn');

hamburger.addEventListener('click', () => {
    sideNav.style.width = "280px";
});

closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sideNav.style.width = "0";
});

// About Alert
aboutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    alert('JT Mini MIDI Editor\nVersion 1.0\nCreated for Behringer JT Mini Synthesizer');
});

// Close menu if clicking anywhere outside the side-nav
window.addEventListener('click', (e) => {
    // lets the link work!
    if (e.target.classList.contains('linkText')) {
        return; 
    }

    if (e.target !== hamburger && !hamburger.contains(e.target) && e.target !== sideNav && !sideNav.contains(e.target)) {
        sideNav.style.width = "0";
    }
});

// --- ACCORDION LOGIC ---
const acc = document.getElementsByClassName("accordion-header");
for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
        const panel = this.nextElementSibling;
        const isActive = this.classList.contains("active");
        for (let j = 0; j < acc.length; j++) {
            acc[j].classList.remove("active");
            acc[j].nextElementSibling.style.maxHeight = null;
        }
        if (!isActive) {
            this.classList.add("active");
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    });
}