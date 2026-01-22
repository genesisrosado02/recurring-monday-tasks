const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.status(200).send("Server is live."));

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Helper for Monday API Calls
async function updateMondayItem(boardId, itemId, columnValues) {
    const query = `mutation { 
        change_multiple_column_values (
            board_id: ${parseInt(boardId)}, 
            item_id: ${parseInt(itemId)}, 
            create_labels_if_missing: true,
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) { id } 
    }`;

    return axios.post('https://api.monday.com/v2', { query }, { 
        headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
    });
}

// --- NEW ENDPOINT: SET END OF MONTH DEADLINE ---
app.post('/set-month-end-deadline', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inboundFieldValues || payload.inputFields;
        const { boardId, itemId, client_column, client_name_value } = fields;

        const now = new Date();
        // Calculation for the last day of the current month
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const dueDate = lastDay.toISOString().split('T')[0];
        const monthLabel = monthNames[now.getMonth()];

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
            [client_column]: { "label": client_name_value },
            [process.env.MONTH_STATUS_COLUMN_ID]: { "label": monthLabel }
        };

        await updateMondayItem(boardId, itemId, columnValues);
        console.log(`Updated Item ${itemId}: Set to ${monthLabel} 31st (or last day)`);
        
        res.status(200).send({});
    } catch (err) { console.error("Error setting deadline:", err.message); res.status(200).send({}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));
