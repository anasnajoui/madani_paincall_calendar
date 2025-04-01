// Configuration
const CONFIG = {
    calendarId: 'MyZldzj3ZYtwz5gjQW6D',
    locationId: 's5MRQQ7j3TjZXRe0CtvE',
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6InM1TVJRUTdqM1RqWlhSZTBDdHZFIiwiY29tcGFueV9pZCI6IkR0anBxVUZmaHZyNlJIak9WcWR6IiwidmVyc2lvbiI6MSwiaWF0IjoxNjkxOTUwNTEzMjg4LCJzdWIiOiJ4TVZiOHVTVHNvTTkzNjNFbW1ubyJ9.aexZGVFaqG_L6n3VPzP7xdZIiyqKp8-6nEi3HZWQ7jI',
    apiEndpoint: 'https://rest.gohighlevel.com/v1/appointments/', // Endpoint per la prenotazione di appuntamenti
    meetingInterval: 30,
    meetingDuration: 25,
    dateRange: 3,
    maxBookingsPerSlot: 1,
    debugMode: true // Attivato per visualizzare i messaggi di debug nella console
};

// DOM Elements
const preferenceStep = document.getElementById('step-preference');
const timeslotsStep = document.getElementById('step-timeslots');
const contactStep = document.getElementById('step-contact');
const confirmationStep = document.getElementById('step-confirmation');
const preferenceOptions = document.querySelectorAll('.preference-option');
const backToPreference = document.getElementById('back-to-preference');
const backToTimeslots = document.getElementById('back-to-timeslots');
const datesContainer = document.getElementById('dates-container');
const timeslotsContainer = document.getElementById('timeslots-container');
const contactForm = document.getElementById('contact-form');
const prevDatesButton = document.getElementById('prev-dates');
const nextDatesButton = document.getElementById('next-dates');
const appointmentDetails = document.getElementById('appointment-details');

// State
let state = {
    preference: null,
    selectedDate: null,
    selectedDateObj: null,
    selectedTime: null,
    timeSlots: {},
    currentDatePage: 0,
    datesPerPage: getOptimalDatesPerPage(),
    availableDates: [],
    availableAPISlots: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    attachEventListeners();
    
    // Testiamo la connessione all'API di GoHighLevel
    testApiConnection();
}

function attachEventListeners() {
    // Preference selection
    preferenceOptions.forEach(option => {
        option.addEventListener('click', () => {
            const preference = option.getAttribute('data-preference');
            selectPreference(preference, option);
        });
    });

    // Back buttons
    backToPreference.addEventListener('click', () => {
        showStep(preferenceStep);
        hideStep(timeslotsStep);
    });

    backToTimeslots.addEventListener('click', () => {
        showStep(timeslotsStep);
        hideStep(contactStep);
    });

    // Date navigation
    prevDatesButton.addEventListener('click', () => {
        if (state.currentDatePage > 0) {
            state.currentDatePage--;
            renderAvailableDates();
        }
    });

    nextDatesButton.addEventListener('click', () => {
        const maxPages = Math.ceil(state.availableDates.length / state.datesPerPage);
        if (state.currentDatePage < maxPages - 1) {
            state.currentDatePage++;
            renderAvailableDates();
        }
    });

    // Contact form submission
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitAppointment();
    });

    // Adjust dates per page on window resize
    window.addEventListener('resize', () => {
        const newDatesPerPage = getOptimalDatesPerPage();
        if (newDatesPerPage !== state.datesPerPage) {
            state.datesPerPage = newDatesPerPage;
            renderAvailableDates();
        }
    });
}

function getOptimalDatesPerPage() {
    // Determine how many date cards to show based on screen width
    const width = window.innerWidth;
    
    if (width < 360) {
        return 3; // Very small mobile screens
    } else if (width < 480) {
        return 4; // Mobile screens
    } else {
        return 5; // Larger screens
    }
}

function selectPreference(preference, element) {
    state.preference = preference;
    
    // Update UI
    preferenceOptions.forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    
    // Generate dates and fetch available slots
    generateDatesForPreference(preference);
    
    // Move to next step
    showStep(timeslotsStep);
    hideStep(preferenceStep);
}

function generateDatesForPreference(preference) {
    const today = new Date();
    state.availableDates = [];
    
    // Generate dates for the next CONFIG.dateRange days
    for (let i = 0; i < CONFIG.dateRange * 2; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Skip weekends if needed (uncomment if needed)
        // if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // Aggiungiamo tutte le date e poi le filtreremo dopo aver ricevuto gli slot disponibili
        state.availableDates.push(date);
    }
    
    // Reset pagination
    state.currentDatePage = 0;
    
    // Fetch disponibilità per tutte le date e poi filtrare
    fetchAvailabilityForDates(preference);
}

function fetchAvailabilityForDates(preference) {
    // Mostra indicatore di caricamento
    datesContainer.innerHTML = '<div class="loading-slots">Caricamento giorni disponibili...</div>';
    timeslotsContainer.innerHTML = '';
    
    // Calcola l'intervallo di date per cui vogliamo verificare la disponibilità
    const startDate = new Date(state.availableDates[0]);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(state.availableDates[state.availableDates.length - 1]);
    endDate.setHours(23, 59, 59, 999);
    
    // Converte in timestamp epoch (millisecondi)
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    // Ottieni timezone locale
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Costruisci URL per la richiesta API
    const url = `${CONFIG.apiEndpoint.replace('/appointments/', '/appointments/slots')}?calendarId=${CONFIG.calendarId}&startDate=${startTimestamp}&endDate=${endTimestamp}&timezone=${encodeURIComponent(timezone)}`;
    
    logDebug('Richiesta disponibilità per intervallo date', {
        url: url,
        startDate: new Date(startTimestamp).toISOString(),
        endDate: new Date(endTimestamp).toISOString(),
        timezone: timezone,
        preference: preference
    });
    
    // Chiamata all'API per ottenere gli slot disponibili
    fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                logDebug('Errore nella richiesta slot', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text
                });
                throw new Error(`Errore API: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        logDebug('Slot disponibili ricevuti dall\'API per tutte le date', data);
        
        // Filtra le date in base alla presenza di slot nella fascia oraria selezionata
        filterDatesBasedOnAvailability(data, preference);
    })
    .catch(error => {
        logDebug('Errore durante il recupero degli slot', error);
        // In caso di errore, mostra comunque tutte le date
        renderAvailableDates();
        
        // Mostra un messaggio di errore
        datesContainer.innerHTML += '<div class="error-message">Impossibile verificare la disponibilità. Verranno mostrati tutti i giorni.</div>';
        
        // Solo per testing/sviluppo: genera date fittizie in caso di errore API
        if (CONFIG.debugMode) {
            logDebug('Mostrando tutte le date per debug', { dates: state.availableDates });
        }
    });
}

// Nuova funzione per filtrare le date in base alla disponibilità
function filterDatesBasedOnAvailability(data, preference) {
    if (!data) {
        renderAvailableDates();
        return;
    }
    
    const availableDatesWithSlots = [];
    
    // Per ogni data nella nostra lista
    for (const date of state.availableDates) {
        const formattedDate = formatDate(date);
        
        // Verifica se ci sono slot per questa data
        if (data[formattedDate] && data[formattedDate].slots && data[formattedDate].slots.length > 0) {
            // Filtra gli slot in base alla preferenza (mattina/pomeriggio)
            const hasPreferredSlots = data[formattedDate].slots.some(slotISOString => {
                const slotDate = new Date(slotISOString);
                const hours = slotDate.getHours();
                
                // Mattina: dalle 8:00 alle 12:59
                // Pomeriggio: dalle 13:00 alle 19:59
                if (preference === 'morning' && hours >= 8 && hours < 13) {
                    return true;
                } else if (preference === 'afternoon' && hours >= 13 && hours < 20) {
                    return true;
                }
                return false;
            });
            
            // Aggiungi la data solo se ha slot nella fascia oraria preferita
            if (hasPreferredSlots) {
                availableDatesWithSlots.push(date);
            }
        }
    }
    
    logDebug('Date filtrate in base alla disponibilità', {
        preference: preference,
        totalDates: state.availableDates.length,
        availableDates: availableDatesWithSlots.length
    });
    
    // Aggiorna lo stato con le date filtrate
    state.availableDates = availableDatesWithSlots;
    
    // Render delle date disponibili
    renderAvailableDates();
    
    // Seleziona la prima data se disponibile
    if (state.availableDates.length > 0) {
        selectDate(state.availableDates[0], document.querySelector('.date-card'));
    } else {
        // Nessuna data disponibile con gli slot richiesti
        timeslotsContainer.innerHTML = '<div class="no-slots-message">Nessun orario disponibile per la preferenza selezionata.</div>';
    }
}

function renderAvailableDates() {
    datesContainer.innerHTML = '';
    
    const startIdx = state.currentDatePage * state.datesPerPage;
    const endIdx = startIdx + state.datesPerPage;
    const visibleDates = state.availableDates.slice(startIdx, endIdx);
    
    visibleDates.forEach(date => {
        const dateCard = createDateCard(date);
        datesContainer.appendChild(dateCard);
    });
    
    // Update navigation button states
    prevDatesButton.disabled = state.currentDatePage === 0;
    const maxPages = Math.ceil(state.availableDates.length / state.datesPerPage);
    nextDatesButton.disabled = state.currentDatePage >= maxPages - 1;
}

function createDateCard(date) {
    const dateCard = document.createElement('div');
    dateCard.className = 'date-card';
    
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    
    dateCard.innerHTML = `
        <div class="day-name">${dayNames[date.getDay()]}</div>
        <div class="day-number">${date.getDate()}</div>
        <div class="month">${monthNames[date.getMonth()]}</div>
    `;
    
    dateCard.addEventListener('click', () => {
        selectDate(date, dateCard);
    });
    
    return dateCard;
}

function selectDate(date, element) {
    state.selectedDateObj = date;
    state.selectedDate = formatDate(date);
    
    // Update UI
    document.querySelectorAll('.date-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    
    // Fetch time slots for this date
    fetchTimeSlotsForDate(date);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fetchTimeSlotsForDate(date) {
    // Mostra indicatore di caricamento
    timeslotsContainer.innerHTML = '<div class="loading-slots">Caricamento orari disponibili...</div>';
    
    // Converte la data selezionata in timestamp epoch per l'API
    const selectedDateObj = new Date(date);
    
    // Imposta inizio giornata (00:00:00)
    const startDate = new Date(selectedDateObj);
    startDate.setHours(0, 0, 0, 0);
    
    // Imposta fine giornata (23:59:59)
    const endDate = new Date(selectedDateObj);
    endDate.setHours(23, 59, 59, 999);
    
    // Converte in timestamp epoch (millisecondi)
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    // Ottieni timezone locale
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Costruisci URL per la richiesta API
    const url = `${CONFIG.apiEndpoint.replace('/appointments/', '/appointments/slots')}?calendarId=${CONFIG.calendarId}&startDate=${startTimestamp}&endDate=${endTimestamp}&timezone=${encodeURIComponent(timezone)}`;
    
    logDebug('Richiesta slot disponibili all\'API', {
        url: url,
        startDate: new Date(startTimestamp).toISOString(),
        endDate: new Date(endTimestamp).toISOString(),
        timezone: timezone
    });
    
    // Chiamata all'API per ottenere gli slot disponibili
    fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                logDebug('Errore nella richiesta slot', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text
                });
                throw new Error(`Errore API: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        logDebug('Slot disponibili ricevuti dall\'API', data);
        
        // Visualizza gli slot disponibili
        displayAvailableSlots(data, date);
    })
    .catch(error => {
        logDebug('Errore durante il recupero degli slot', error);
        // In caso di errore, mostra un messaggio all'utente
        timeslotsContainer.innerHTML = '<div class="error-message">Impossibile caricare gli orari disponibili. Riprova più tardi.</div>';
        
        // Solo per testing/sviluppo: genera slot fittizi in caso di errore API
        if (CONFIG.debugMode) {
            logDebug('Generando slot fittizi per debug', { date: date });
            generateMockTimeSlots(date);
        }
    });
}

function displayAvailableSlots(data, date) {
    timeslotsContainer.innerHTML = '';
    const formattedDate = formatDate(date);
    
    // Verifica se ci sono dati per la data selezionata
    if (!data || !data[formattedDate] || !data[formattedDate].slots || data[formattedDate].slots.length === 0) {
        timeslotsContainer.innerHTML = '<div class="no-slots-message">Nessun orario disponibile per la data selezionata.</div>';
        return;
    }
    
    // Ottieni gli slot per la data selezionata
    const slots = data[formattedDate].slots.sort();
    
    logDebug('Elaborazione slot disponibili', {
        date: formattedDate,
        slotsCount: slots.length
    });
    
    // Manteniamo una mappa degli slot originali per recuperarli quando vengono selezionati
    state.availableAPISlots = {};
    
    // Filtra gli slot in base alla preferenza selezionata
    const filteredSlots = slots.filter(slotISOString => {
        const slotDate = new Date(slotISOString);
        const hours = slotDate.getHours();
        
        // Mattina: dalle 8:00 alle 12:59
        // Pomeriggio: dalle 13:00 alle 19:59
        if (state.preference === 'morning' && hours >= 8 && hours < 13) {
            return true;
        } else if (state.preference === 'afternoon' && hours >= 13 && hours < 20) {
            return true;
        }
        return false;
    });
    
    logDebug('Slot filtrati per preferenza', {
        preference: state.preference,
        totalSlots: slots.length,
        filteredSlotsCount: filteredSlots.length
    });
    
    // Se non ci sono slot dopo il filtraggio, mostra un messaggio
    if (filteredSlots.length === 0) {
        timeslotsContainer.innerHTML = '<div class="no-slots-message">Nessun orario disponibile per la data selezionata nel periodo scelto.</div>';
        return;
    }
    
    // Seleziona casualmente solo 3 slot da mostrare
    const selectedSlots = [];
    const availableSlots = [...filteredSlots];
    
    // Determina quanti slot selezionare (massimo 3 o meno se sono disponibili meno di 3)
    const slotsToSelect = Math.min(3, availableSlots.length);
    
    // Seleziona casualmente gli slot
    for (let i = 0; i < slotsToSelect; i++) {
        // Scegli un indice casuale dall'array degli slot disponibili
        const randomIndex = Math.floor(Math.random() * availableSlots.length);
        // Aggiungi lo slot selezionato all'array dei selezionati
        selectedSlots.push(availableSlots[randomIndex]);
        // Rimuovi lo slot selezionato dall'array degli slot disponibili
        availableSlots.splice(randomIndex, 1);
    }
    
    logDebug('Slot selezionati casualmente', {
        totalFiltered: filteredSlots.length,
        selectedCount: selectedSlots.length,
        selectedSlots: selectedSlots.map(slot => new Date(slot).toLocaleTimeString())
    });
    
    // Ordina gli slot selezionati in ordine cronologico
    selectedSlots.sort();
    
    // Mostra gli slot selezionati
    selectedSlots.forEach(slotISOString => {
        // Estrai solo l'ora e i minuti dalla data ISO
        const slotDate = new Date(slotISOString);
        const hours = slotDate.getHours();
        const minutes = slotDate.getMinutes();
        const timeString = `${hours}:${minutes === 0 ? '00' : minutes}`;
        
        // Salva l'orario ISO originale per usarlo in seguito
        const slotKey = `${formatDate(date)}_${timeString}`;
        state.availableAPISlots[slotKey] = slotISOString;
        
        // Crea lo slot di tempo
        const timeSlot = createTimeSlot(timeString, date, slotISOString);
        timeslotsContainer.appendChild(timeSlot);
    });
    
    if (timeslotsContainer.children.length === 0) {
        timeslotsContainer.innerHTML = '<div class="no-slots-message">Nessun orario disponibile per la data selezionata nel periodo scelto.</div>';
    }
}

function generateMockTimeSlots(date) {
    timeslotsContainer.innerHTML = '';
    const formattedDate = formatDate(date);
    
    // Generate time slots based on preference
    const slots = [];
    const preference = state.preference;
    
    if (preference === 'morning') {
        // Morning slots (9:00 AM to 12:00 PM)
        for (let hour = 9; hour < 13; hour++) {
            slots.push(`${hour}:00`);
            if (hour < 12) slots.push(`${hour}:30`);
        }
    } else if (preference === 'afternoon') {
        // Afternoon slots (1:00 PM to 6:00 PM)
        for (let hour = 13; hour < 19; hour++) {
            slots.push(`${hour}:00`);
            if (hour < 18) slots.push(`${hour}:30`);
        }
    }
    
    // Display only two slots for the selected day and two for another day
    // (as per requirements, simplifying for demo)
    const limitedSlots = preference === 'morning' ? 
        ['09:00', '11:00'] : 
        ['14:00', '16:30'];
    
    // Store time slots for this date
    state.timeSlots[formattedDate] = limitedSlots;
    
    // Create UI elements for the time slots
    limitedSlots.forEach(time => {
        const timeslot = createTimeSlot(time, formattedDate);
        timeslotsContainer.appendChild(timeslot);
    });
    
    // Find next available date
    const nextDateIndex = state.availableDates.findIndex(d => formatDate(d) === formattedDate) + 1;
    if (nextDateIndex < state.availableDates.length) {
        const nextDate = state.availableDates[nextDateIndex];
        const nextFormattedDate = formatDate(nextDate);
        
        // Add two slots for the next day
        const nextDaySlots = preference === 'morning' ? 
            ['10:30', '12:00'] : 
            ['15:00', '17:30'];
        
        // Store time slots for next date
        state.timeSlots[nextFormattedDate] = nextDaySlots;
        
        // Create UI elements for the next day time slots
        nextDaySlots.forEach(time => {
            const timeslot = createTimeSlot(time, nextFormattedDate);
            timeslotsContainer.appendChild(timeslot);
        });
    }
}

function createTimeSlot(time, date, originalISOString) {
    const timeslot = document.createElement('div');
    timeslot.className = 'timeslot';
    
    // Format date for display (we'll still need this info for the backend)
    const dateObj = new Date(date);
    
    // Calculate end time (25 minutes after start)
    const [hours, minutes] = time.split(':');
    const startTime = new Date();
    startTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 25);
    
    const endTimeStr = `${endTime.getHours()}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    
    // Format time display for clarity
    const timeDisplay = time.replace(':', '.'); // Replace : with . (e.g., 10:00 becomes 10.00)
    
    timeslot.innerHTML = `
        <div class="time">${timeDisplay}</div>
        <div class="duration">25 min</div>
    `;
    
    // Salva l'ISO string originale come attributo data
    timeslot.dataset.isoString = originalISOString;
    
    timeslot.addEventListener('click', () => {
        selectTimeSlot(time, date, timeslot, originalISOString);
    });
    
    return timeslot;
}

function formatTimeForDisplay(time) {
    // Just return the time in 24-hour format
    return time;
}

function selectTimeSlot(time, date, element, originalISOString) {
    // Salva il tiempo selezionato per il form
    state.selectedTime = time;
    state.selectedDate = formatDate(date);
    
    // IMPORTANTE: Salva anche il formato originale ISO ricevuto dall'API
    state.selectedSlotISO = originalISOString || element.dataset.isoString;
    
    logDebug('Slot selezionato', {
        time: time,
        date: state.selectedDate,
        originalISOString: state.selectedSlotISO
    });
    
    // Update UI
    document.querySelectorAll('.timeslot').forEach(slot => slot.classList.remove('selected'));
    element.classList.add('selected');
    
    // Move to next step
    showStep(contactStep);
    hideStep(timeslotsStep);
}

function submitAppointment() {
    // Validate the form
    const email = document.getElementById('email').value;
    
    if (!email) {
        alert('Per favore inserisci la tua email');
        return;
    }
    
    if (!validateEmail(email)) {
        alert('Per favore inserisci un indirizzo email valido');
        return;
    }
    
    // Disable submit button to prevent double submission
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Prenotazione in corso...';
    
    // Get timezone from browser
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Prepare appointment data according to GoHighLevel API requirements
    const appointmentData = {
        email: email,
        calendarId: CONFIG.calendarId,
        selectedTimezone: timezone,
        selectedSlot: state.selectedSlotISO
    };
    
    // Save the data to localStorage to avoid losing it
    localStorage.setItem('appointmentData', JSON.stringify(appointmentData));
    
    // Book the appointment
    bookAppointment(appointmentData);
}

function bookAppointment(appointmentData) {
    // Disable submit button and show loading state
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Prenotazione in corso...';
    
    // Prepare the API data in the exact format required by GoHighLevel
    const apiData = {
        calendarId: appointmentData.calendarId,
        selectedTimezone: appointmentData.selectedTimezone,
        selectedSlot: appointmentData.selectedSlot,
        email: appointmentData.email
    };
    
    logDebug('Sending appointment data to GoHighLevel API', apiData);
    
    // Make the API call to GoHighLevel
    fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.apiKey}`
        },
        body: JSON.stringify(apiData)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                logDebug('API Error Response', {
                    status: response.status,
                    text: text
                });
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(`Error: ${errorData.message || 'Unknown error'}`);
                } catch (e) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        logDebug('Appointment booked successfully', data);
        showConfirmation(appointmentData);
    })
    .catch(error => {
        logDebug('Error booking appointment', error.message);
        alert(`Si è verificato un errore: ${error.message}`);
        
        // Re-enable button for retry
        submitButton.disabled = false;
        submitButton.innerHTML = 'Conferma Appuntamento';
    });
}

function showConfirmation(appointmentData) {
    // Clear previous details
    const appointmentDetails = document.getElementById('appointment-details');
    appointmentDetails.innerHTML = '';
    
    // Format date and time for display
    const dateObj = new Date(appointmentData.selectedSlot);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = dateObj.toLocaleDateString('it-IT', options);
    const formattedTime = `${dateObj.getHours()}.${String(dateObj.getMinutes()).padStart(2, '0')}`;
    
    // Create detail items
    const details = [
        { label: 'Data', value: formattedDate },
        { label: 'Orario', value: formattedTime },
        { label: 'Email', value: appointmentData.email }
    ];
    
    details.forEach(detail => {
        const detailElement = document.createElement('div');
        detailElement.className = 'detail-item';
        detailElement.innerHTML = `
            <div class="label">${detail.label}</div>
            <div class="value">${detail.value}</div>
        `;
        appointmentDetails.appendChild(detailElement);
    });
    
    // Show confirmation step
    hideStep(contactStep);
    showStep(confirmationStep);
}

// Funzione di utilità per verificare la validità di una data ISO8601
function isValidISOString(str) {
    try {
        const date = new Date(str);
        return date.toISOString() === str;
    } catch (e) {
        return false;
    }
}

// Funzione di utilità per formattare la data nel formato richiesto dall'API GoHighLevel
function formatDateForApi(date) {
    // La data deve essere in formato locale (non UTC) ma con l'offset di timezone corretto
    // Formato richiesto: "2025-03-08T21:13:36+01:00" (con il corretto offset del browser)
    
    // Usiamo i valori locali della data, non UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Calcolo dell'offset timezone
    const tzOffset = -date.getTimezoneOffset();
    const tzOffsetHours = Math.floor(Math.abs(tzOffset) / 60);
    const tzOffsetMinutes = Math.abs(tzOffset) % 60;
    const tzOffsetSign = tzOffset >= 0 ? '+' : '-';
    const tzOffsetString = `${tzOffsetSign}${String(tzOffsetHours).padStart(2, '0')}:${String(tzOffsetMinutes).padStart(2, '0')}`;
    
    // Formatto la data con il timezone locale
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzOffsetString}`;
}

// Funzione di utilità per verificare la validità di una data ISO8601 con offset
function isValidDateWithOffset(str) {
    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
    return regex.test(str);
}

// Utility functions
function showStep(step) {
    step.classList.remove('hidden');
}

function hideStep(step) {
    step.classList.add('hidden');
}

// Funzione di logging per debug
function logDebug(message, data) {
    if (CONFIG.debugMode) {
        console.log(`[DEBUG] ${message}`, data);
        
        // Se c'è un elemento di debug nella pagina, aggiorniamolo
        const debugElement = document.getElementById('debug-output');
        if (debugElement) {
            const timestamp = new Date().toLocaleTimeString();
            const newLog = document.createElement('div');
            newLog.innerHTML = `<strong>${timestamp}:</strong> ${message}`;
            if (data) {
                const dataDisplay = document.createElement('pre');
                dataDisplay.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
                newLog.appendChild(dataDisplay);
            }
            debugElement.appendChild(newLog);
            debugElement.scrollTop = debugElement.scrollHeight;
        }
    }
}

// Funzione per testare la connessione all'API
function testApiConnection() {
    if (!CONFIG.debugMode) return;
    
    logDebug('Testando la connessione all\'API GoHighLevel...', {
        calendarId: CONFIG.calendarId,
        locationId: CONFIG.locationId
    });
    
    // Facciamo una richiesta GET per verificare se il token è valido
    fetch(`https://rest.gohighlevel.com/v1/contacts/`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.apiKey}`
        }
    })
    .then(response => {
        logDebug('Test API - Risposta ricevuta', {
            status: response.status,
            statusText: response.statusText
        });
        
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    logDebug('Test API - Errore', errorData);
                    throw new Error(`Errore API: ${errorData.message || errorData.error || 'Errore sconosciuto'}`);
                } catch (e) {
                    logDebug('Test API - Risposta non JSON', text);
                    throw new Error(`HTTP error! status: ${response.status} - ${text || response.statusText}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        logDebug('Test API - Connessione riuscita!', {
            message: 'Token API valido',
            response: data
        });
    })
    .catch(error => {
        logDebug('Test API - Errore di connessione', error.message || error);
        console.error('Errore nella connessione all\'API GoHighLevel:', error);
    });
}

// Validation functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    // Basic validation - at least 8 digits
    return phone.replace(/\D/g, '').length >= 8;
} 