/**
 * Published transaction processor function.
 * @param {org.acme.loan.CreditLoan} tx The credited loan transaction instance.
 * @transaction
 */

 async function CreditLoan(tx) {   
 	if(tx.loan.borrowerRequest.isDone) {
 		throw new Error("Your loan is already fulfilled."); 
 	}
    if(tx.loan.lender.accountBalance < tx.amount) {
      throw new Error("Insufficient Balance in your account"); 
    }
    let remainingBorrowerLoan = tx.loan.borrowerRequest.amountRequested - tx.loan.borrowerRequest.amountFulfilled;
    if(tx.amount > remainingBorrowerLoan) {
      throw new Error(`Your amount exceeds the remaining loan amount of borrower: ${remainingBorrowerLoan}`);
    }
    tx.loan.lender.accountBalance -= tx.amount;
    tx.loan.borrowerRequest.amountFulfilled += tx.amount; 
    tx.loan.status = "CREDITED";
    tx.loan.amount = tx.amount;
   
    if(tx.loan.borrowerRequest.amountFulfilled == tx.loan.borrowerRequest.amountRequested) {
      tx.loan.borrowerRequest.isDone = true;
        tx.loan.borrowerRequest.borrower.accountBalance = tx.loan.borrowerRequest.amountFulfilled;
        tx.loan.borrowerRequest.borrower.total += 1;
    }
    
    let date = new Date();
    tx.loan.endDate = new Date(date.setMonth(date.getMonth() + tx.loan.borrowerRequest.durationOfLoanInMonths));
   
    let lenderRegistry = await getParticipantRegistry('org.acme.loan.Lender');
  await lenderRegistry.update(tx.loan.lender);
   
    let borrowerRegistry = await getParticipantRegistry('org.acme.loan.BorrowerRequest');
  await borrowerRegistry.update(tx.loan.borrowerRequest);
   
    let br = await getParticipantRegistry('org.acme.loan.Borrower');
  await br.update(tx.loan.borrowerRequest.borrower);
   
    let assetRegistry = await getAssetRegistry('org.acme.loan.Loan');
    await assetRegistry.update(tx.loan);
 }

/**
 * Published transaction processor function.
 * @param {org.acme.loan.RepayLoan} tx The repaid loan transaction instance.
 * @transaction
 */
async function RepayLoan(tx) {
	if(tx.borrowerRequest.isRepaid) {
      throw new Error("You have already repaid the loan."); 
    }
  if(tx.borrowerRequest.borrower.accountBalance < tx.amount) {
      throw new Error("Insufficient Balance in your account"); 
    }
    tx.loan.lender.accountBalance += tx.amount;
    tx.borrowerRequest.borrower.accountBalance -= tx.amount; 
    tx.loan.borrowerRequest.amountRepaid += tx.amount;
    tx.loan.status = "REPAID";
    tx.loan.amount = tx.amount;
  
  if(tx.loan.borrowerRequest.amountFulfilled == tx.loan.borrowerRequest.amountRepaid) {
      tx.loan.borrowerRequest.isRepaid = true;
    }
  
    let lenderRegistry = await getParticipantRegistry('org.acme.loan.Lender');
  await lenderRegistry.update(tx.loan.lender);
   
    let borrowerRegistry = await getParticipantRegistry('org.acme.loan.BorrowerRequest');
  await borrowerRegistry.update(tx.loan.borrowerRequest);
   
    let br = await getParticipantRegistry('org.acme.loan.Borrower');
  await br.update(tx.loan.borrowerRequest.borrower);
   
    let assetRegistry = await getAssetRegistry('org.acme.loan.Loan');
    await assetRegistry.update(tx.loan);
    
}
/**
 * Published transaction processor function.
 * @param {org.acme.loan.addNewLender} tx The credited loan transaction instance.
 * @transaction
 */

async function addNewLender() {
  
    const factory = getFactory();
    const namespace = 'org.acme.loan';
  // get the borrower
    const borrowerRegistry = await getParticipantRegistry(namespace + '.Borrower');
    const borrower = await borrowerRegistry.get("b1");
  
  // get the lender
    const lenderRegistry = await getParticipantRegistry(namespace + '.Lender');
    const lender = await lenderRegistry.get("l2");
  
    const loanRegistry = await getAssetRegistry(namespace + '.Loan');
    const loan = factory.newResource(namespace, 'Loan', 'loan2');
    loan.borrower = borrower;
    loan.lender = lender;
    loan.startDate = new Date();
    loan.endDate = new Date();
    loan.status = 'CREDITED';
    loan.amount = 0;
    await loanRegistry.add(loan);
}

/**
 * Create the participants to use in the demo
 * @param {org.acme.loan.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
async function setupDemo() { // eslint-disable-line no-unused-vars
    console.log('setupDemo');

    const factory = getFactory();
    const namespace = 'org.acme.loan';
  
    // create a borrower participant resource
    const borrower = factory.newResource(namespace, 'Borrower', 'b1');
    borrower.amountRequested = 1000;
    borrower.amountFulfilled = 0;

    // add the borrower
    const borrowerRegistry = await getParticipantRegistry(namespace + '.Borrower');
    await borrowerRegistry.add(borrower);
  
    // create a lender participant resource
    const lender = factory.newResource(namespace, 'Lender', 'l1');
    lender.accountBalance = 10000;
    
    // add the lender participant resource
    const lenderRegistry = await getParticipantRegistry(namespace +'.Lender');
    await lenderRegistry.add(lender);
  
    const loanRegistry = await getAssetRegistry(namespace + '.Loan');
    const loan = factory.newResource(namespace, 'Loan', 'loan1');
    loan.borrower = borrower;
    loan.lender = lender;
    loan.startDate = new Date();
    loan.endDate = new Date();
    loan.status = 'CREDITED';
    loan.amount = 0;
    await loanRegistry.add(loan);
}