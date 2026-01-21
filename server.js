const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.status(200).send("Server is live."));

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- OPTION ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));
app.all('/get-day-of-month-options', (req, res) => {
    const options = Array.from({ length: 31 }, (_, i) => {
        const n = i + 1;
        const s = ["th", "st", "nd", "rd"], v = n % 100;
        const suffix = s[(v - 20) % 10] || s[v] || s[0];
        return { title: `${n}${suffix}`, value: `${n}` };
    });
    res.json(options);
});

// --- SHARED ITEM CREATION ENGINE ---
async function createMondayItem(boardId, groupId, itemName, dueDate, clientName, monthName, clientColumnId) {
    console.log(`CREATING: ${itemName} | CLIENT: ${clientName} IN COL: ${clientColumnId}`);

    const columnValues = {
        [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
        [clientColumnId]: { "label": clientName }, 
        [process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthName }
    };

    const query = `mutation { 
        create_item (
            board_id: ${parseInt(boardId)}, 
            group_id: "${groupId}", 
            item_name: "${itemName}", 
            create_labels_if_missing: true,
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) { id } 
    }`;

    return axios.post('https://api.monday.com/v2', { query }, { 
        headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
    });
}

// AUTOMATION 1: Nth Day (Current Month) - NEW ENDPOINT NAME
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields;
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(fields.day_of_week?.value || fields.day_of_week)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(fields.nth_occurence?.value || fields.nth_occurence) - 1) * 7);
        
        await createMondayItem(fields.boardId, fields.groupId, fields.name, d.toISOString().split('T')[0], fields.client_name_value, monthNames[d.getMonth()], fields.client_column);
        res.status(200).send({});
    } catch (err) { console.error("Error Nth Day:", err.message); res.status(200).send({}); }
});

// AUTOMATION 2: X-Day (Next Month)
app.post('/calculate-next-month-task', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields;
        
        const now = new Date();
        let nextYear = now.getFullYear();
        let nextMonthIndex = now.getMonth() + 1;
        if (nextMonthIndex > 11) { nextMonthIndex = 0; nextYear++; }

        const dayToSet = parseInt(fields.day_of_month?.value || fields.day_of_month || 1);
        const dueDate = new Date(nextYear, nextMonthIndex, dayToSet).toISOString().split('T')[0];
        
        await createMondayItem(fields.boardId, fields.groupId, fields.name, dueDate, fields.client_name_value, monthNames[nextMonthIndex], fields.client_column);
        res.status(200).send({});
    } catch (err) { console.error("Error Next Month:", err.message); res.status(200).send({}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));
