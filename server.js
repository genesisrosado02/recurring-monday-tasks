const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.status(200).send("Server is live."));

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- OPTION ENDPOINTS (For the Nth Day Dropdowns) ---
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

// --- AUTOMATION 1: Nth Day of Current Month ---
// This one still CREATES a new item with specific Nth day logic
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields;
        
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(fields.day_of_week?.value || fields.day_of_week)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(fields.nth_occurence?.value || fields.nth_occurence) - 1) * 7);
        
        const dueDate = d.toISOString().split('T')[0];
        const monthLabel = monthNames[d.getMonth()];

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
            [fields.client_column]: { "label": fields.client_name_value },
            [process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthLabel }
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(fields.boardId)}, 
                group_id: "${fields.groupId}", 
                item_name: "${fields.name}", 
                create_labels_if_missing: true,
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        res.status(200).send({});
    } catch (err) { console.error("Error Nth Day:", err.message); res.status(200).send({}); }
});

// --- AUTOMATION 2: SET END OF MONTH (For items already created) ---
// This one UPDATES an existing item that was just created natively
app.post('/set-deadline', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        // PulseId comes from the 'When item is created' trigger output
        const boardId = payload.event.boardId;
        const itemId = payload.event.pulseId;

        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const dueDate = lastDay.toISOString().split('T')[0];
        const currentMonthLabel = monthNames[now.getMonth()];

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
            [process.env.MONTH_STATUS_COLUMN_ID]: { "label": currentMonthLabel }
        };

        const query = `mutation { 
            change_multiple_column_values (
                board_id: ${parseInt(boardId)}, 
                item_id: ${parseInt(itemId)}, 
                create_labels_if_missing: true,
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        res.status(200).send({});
    } catch (err) { console.error("Error setting month-end:", err.message); res.status(200).send({}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));
