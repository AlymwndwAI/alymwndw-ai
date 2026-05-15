const chatBox =
document.getElementById("chat-box");

// =====================
// ADD MESSAGE
// =====================

function addMessage(
text,
type = "ai"
){

const wrapper =
document.createElement("div");

wrapper.className =

type === "user"

? "message user-message"

: "message ai-message";

// =====================
// AVATAR
// =====================

const avatar =
type === "user"

? `
<div class="avatar">
<img src="https://ui-avatars.com/api/?name=U&background=18e0bd&color=000"/>
</div>
`

: `
<div class="avatar">
<img src="deer.png"/>
</div>
`;

// =====================
// BUBBLE
// =====================

wrapper.innerHTML = `

${type === "ai" ? avatar : ""}

<div class="bubble">
${text}
</div>

${type === "user" ? avatar : ""}

`;

chatBox.appendChild(wrapper);

chatBox.scrollTop =
chatBox.scrollHeight;

return wrapper;

}

// =====================
// TYPING
// =====================

function showTyping(){

const typing =
document.createElement("div");

typing.className =
"message ai-message";

typing.id =
"typing";

typing.innerHTML = `

<div class="avatar">
<img src="deer.png"/>
</div>

<div class="bubble">

<div class="typing">

<div class="dot"></div>
<div class="dot"></div>
<div class="dot"></div>

</div>

</div>

`;

chatBox.appendChild(typing);

chatBox.scrollTop =
chatBox.scrollHeight;

}

// =====================
// REMOVE TYPING
// =====================

function removeTyping(){

const typing =
document.getElementById(
"typing"
);

if(typing){

typing.remove();

}

}

// =====================
// PRODUCT CARD
// =====================

function renderProducts(products){

products.forEach((product)=>{

const variant =
product.variants?.[0] || {};

const image =

variant.image ||

product.image ||

"https://via.placeholder.com/500";

const price =

variant.price ||

product.price ||

"";

const rating =

product.reviewRating ||

4.9;

const reviews =

product.reviewCount ||

120;

const url =

product.url ||

`https://alymwndw.com/products/${product.handle}`;

const card =
document.createElement("div");

card.className =
"product-card";

card.innerHTML = `

<img
src="${image}"
class="product-image"
/>

<div class="product-title">
${product.title}
</div>

<div class="product-price">
${price}
</div>

<div class="product-rating">
⭐ ${rating} (${reviews} reviews)
</div>

<div class="product-buttons">

<a
href="${url}"
target="_blank"
class="view-btn"
>
View
</a>

<a
href="${url}"
target="_blank"
class="cart-btn"
>
Shop
</a>

</div>

`;

chatBox.appendChild(card);

});

chatBox.scrollTop =
chatBox.scrollHeight;

}

// =====================
// HANDLE ENTER
// =====================

function handleKey(event){

if(event.key === "Enter"){

sendMessage();

}

}

// =====================
// SEND MESSAGE
// =====================

async function sendMessage(){

const input =
document.getElementById(
"message"
);

const message =
input.value.trim();

if(!message) return;

// =====================
// USER MESSAGE
// =====================

addMessage(
message,
"user"
);

input.value = "";

// =====================
// SHOW TYPING
// =====================

showTyping();

try {

// =====================
// FETCH
// =====================

const response =
await fetch("/chat",{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:JSON.stringify({
message
})

});

const data =
await response.json();

// =====================
// REMOVE TYPING
// =====================

removeTyping();

// =====================
// AI MESSAGE
// =====================

addMessage(
data.reply,
"ai"
);

// =====================
// PRODUCTS
// =====================

if(
data.products &&
data.products.length
){

setTimeout(()=>{

renderProducts(
data.products
);

},300);

}

} catch(err){

removeTyping();

addMessage(
"Something went wrong.",
"ai"
);

}

}
