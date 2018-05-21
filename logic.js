var factory = getFactory();
var namespace = 'org.acme.loan';
/**
 * Published transaction processor function.
 * @param {org.acme.loan.CreditLoan} tx The credited loan transaction instance.
 * @transaction
 */

async function CreditLoan(tx) {
    if (tx.borrowerRequest.isDone) {
        throw new Error("Your loan is already fulfilled.");
    }
    if(tx.amount == 0 || (tx.amount % 100) != 0) {
        throw new Error("Please enter amount in multiples of 500. For ex. 500, 1000 and so on.")
    }
    if (tx.lender.accountBalance < tx.amount) {
        throw new Error("Insufficient Balance in your account");
    }
    let remainingBorrowerLoan = tx.borrowerRequest.amountRequested - tx.borrowerRequest.amountFulfilled;
    if (tx.amount > remainingBorrowerLoan) {
        throw new Error(`Your amount exceeds the remaining loan amount of borrower: ${remainingBorrowerLoan}`);
    }
    tx.lender.accountBalance -= tx.amount;
    tx.borrowerRequest.amountFulfilled += tx.amount;

    // check if lender is already present
    let currentLender = tx.loan.lenders.filter(lndr => lndr.lender.userId == tx.lender.userId);

    if (currentLender.length > 0) {
        currentLender[0].amount += tx.amount + ( tx.amount/tx.loan.interest );
    } else {
        // create a concept resource to add to lenders array if lender is not present
        const details = getFactory().newConcept('org.acme.loan', 'LenderDetails');
        details.lender = tx.lender;
        details.amount = tx.amount + ( tx.amount/tx.loan.interest );
        tx.loan.lenders.push(details);
    }

    if (tx.borrowerRequest.amountFulfilled == tx.borrowerRequest.amountRequested) {
        tx.borrowerRequest.isDone = true;
        tx.borrowerRequest.borrower.accountBalance = tx.loan.borrowerRequest.amountFulfilled;
        tx.borrowerRequest.borrower.total += 1;
    }

    tx.loan.endDate = new Date(new Date().setMonth(new Date().getMonth() + tx.borrowerRequest.durationOfLoanInMonths));

    let lenderRegistry = await getParticipantRegistry('org.acme.loan.Lender');
    await lenderRegistry.update(tx.lender);

    let borrowerRegistry = await getParticipantRegistry('org.acme.loan.BorrowerRequest');
    await borrowerRegistry.update(tx.borrowerRequest);

    let br = await getParticipantRegistry('org.acme.loan.Borrower');
    await br.update(tx.borrowerRequest.borrower);

    let assetRegistry = await getAssetRegistry('org.acme.loan.Loan');
    await assetRegistry.update(tx.loan);
}

/**
* Published transaction processor function.
* @param {org.acme.loan.RepayLoan} tx The repaid loan transaction instance.
* @transaction
*/
async function RepayLoan(tx) {
    if (tx.borrowerRequest.isRepaid) {
        throw new Error("You have already repaid the loan.");
    }
    if(tx.amount == 0 || (tx.amount % 100) != 0) {
        throw new Error("Please enter amount in multiples of 500. For ex. 500, 1000 and so on.")
    }
    if (tx.borrowerRequest.borrower.accountBalance < tx.amount) {
        throw new Error("Insufficient Balance in your account");
    }
    tx.lender.accountBalance += tx.amount;
    tx.borrowerRequest.borrower.accountBalance -= tx.amount;
    tx.borrowerRequest.amountRepaid += tx.amount;

    // check if lender is already present
    let currentLender = tx.loan.lenders.filter(lndr => lndr.lender.userId == tx.lender.userId);
    currentLender[0].repaid += tx.amount;
  
    let amtWithInterest = tx.borrowerRequest.amountFulfilled + (tx.borrowerRequest.amountFulfilled / tx.loan.interest);
    if ( amtWithInterest == tx.borrowerRequest.amountRepaid ) {
        tx.borrowerRequest.isRepaid = true;
        
        let current = new Date().getTime();
        let end = new Date(tx.loan.endDate).getTime();
        if(current > end) {
            tx.borrowerRequest.borrower.fail += 1;
        }
        if(current == end || current < end) {
            tx.borrowerRequest.borrower.success += 1; 
        }
    }

    let lenderRegistry = await getParticipantRegistry('org.acme.loan.Lender');
    await lenderRegistry.update(tx.lender);

    let borrowerRegistry = await getParticipantRegistry('org.acme.loan.BorrowerRequest');
    await borrowerRegistry.update(tx.borrowerRequest);

    let br = await getParticipantRegistry('org.acme.loan.Borrower');
    await br.update(tx.borrowerRequest.borrower);

    let assetRegistry = await getAssetRegistry('org.acme.loan.Loan');
    await assetRegistry.update(tx.loan);

}

/**
* Published transaction processor function.
* @param {org.acme.loan.RequestLoan} request The request loan transaction instance.
* @transaction
*/

async function RequestLoan(request) {
    // get the registry
    const borrowerRequestRegistry = await getParticipantRegistry(namespace + '.BorrowerRequest');
    const loanAssetRegistry = await getAssetRegistry(namespace + '.Loan');

    // create a borrower request resource
    let requestId = `req-${Math.floor(Math.random()*90000) + 10000}`;
    const borrowerRequest = factory.newResource(namespace, 'BorrowerRequest', requestId);
    borrowerRequest.amountRequested = request.amountRequested;
    borrowerRequest.loanRequirementPurpose = request.loanRequirementPurpose;
    borrowerRequest.durationOfLoanInMonths = request.durationOfLoanInMonths;
    borrowerRequest.borrower = request.borrower;
    await borrowerRequestRegistry.add(borrowerRequest);

    // calculate interest
    let interest;
    if(borrowerRequest.borrower.total == 0) {
        interest = 10;
    } else {
        let reputation = (borrowerRequest.borrower.success / borrowerRequest.borrower.total) * 100;
        
        // good reputation
        if(reputation > 70) {
            interest = 10;
        }

        // mediocre reputation
        if(reputation > 50 && reputation <= 70) {
            interest = 15;
        }

        // below average
        if(reputation > 25 && reputation <= 50) {
            interest = 25;
        }

        // risky
        if(reputation > 0 && reputation <= 25) {
            interest = 35;
        }
    }

  
    // create a loan resource
    let currentDate = new Date();
    let loanId = `loan-${Math.floor(Math.random()*90000) + 10000}`;
    const loan = factory.newResource(namespace, 'Loan', loanId);
    loan.borrowerRequest = borrowerRequest;
    loan.lenders = [];
    loan.startDate = currentDate;
    loan.endDate = currentDate;
    loan.interest = interest;
    await loanAssetRegistry.add(loan);
}