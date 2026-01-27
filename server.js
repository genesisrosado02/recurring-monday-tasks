const express = require('express');
const app = express();
app.use(express.json());

// --- 1. DROPDOWN OPTION ENDPOINTS ---
// These populate the lists in your recipe builder
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"}, {title:"2nd",value:"2"}, {title:"3rd",value:"3"}, {title:"4th",value:"4"}
]));

app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"}, {title:"Tuesday",value:"2"}, {title:"Wednesday",value:"3"}, {title:"Thursday",value:"4"}, {title:"Friday",value:"5"}, {title:"Saturday",value:"6"}, {title:"Sunday",value:"0"}
]));

// --- 2. ENDPOINT 1: Nth DAY CALCULATION ---
// Use this URL in your first Action: https://your-app.render.com/calculate-task-on-nth-day
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const fields = req.body.payload.inputFields || {};
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);

        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        const calculatedDate = d.toISOString().split('T')[0];

        // Spits back to your 'date' output key
        res.status(200).send({ 
            outputFields: { 
                date: calculatedDate,
                itemId: fields.itemId 
            } 
        });
    } catch (err) {
        res.status(200).send({}); 
    }
});

// --- 3. ENDPOINT 2: END OF MONTH DEADLINE ---
// Use this URL in your second Action: https://your-app.render.com/calculate-deadline
app.post('/calculate-deadline', async (req, res) => {
    try {
        const fields = req.body.payload.inputFields || {};
        
        // Logic: Get the last day of the current month
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const formattedDeadline = lastDay.toISOString().split('T')[0];

        console.log(`🏁 Deadline calculated: ${formattedDeadline}`);

        // Spits back to the same 'date' output key
        res.status(200).send({ 
            outputFields: { 
                date: formattedDeadline,
                itemId: fields.itemId
            } 
        });
    } catch (err) {
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Multi-Logic Engine live on port ${PORT}`));
